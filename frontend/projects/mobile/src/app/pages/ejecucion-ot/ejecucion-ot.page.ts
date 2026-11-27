import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonToolbar,
  IonRefresher,
} from '@ionic/angular';
import { Subscription, Observable, tap, forkJoin, of, catchError, finalize } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { avisarErrorAccion, mensajeErrorAccion } from '@core/alertas/mensaje-error';
import { ApiConfig } from '@core/service/api.config';
import { MockDbService } from '@core/service/mock-db.service';
import { SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { CargaOtEstado, cargarOtDesdeRuta, otDesdeFuente } from '@core/service/ot-carga';
import { OtApi } from '@core/service/ot-api';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import {
  EstadoOt,
  MedioPago,
  OtResponse,
  SolicitudInsumoResponse,
} from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';
import { CatalogoInsumosService, ProductoCatalogo } from '../../core/catalogo-insumos';
import { ActivatedRoute } from '@angular/router';
import { ContenidoRecargaComponent, RecargarDirective } from '../../shared/recargar';

/** Only a 409 proves the client has not paid yet or the order moved elsewhere. */
const MENSAJES_DESPLAZAMIENTO: Record<number, string> = {
  409: 'No se pudo iniciar el desplazamiento: el cliente puede no haber pagado la visita todavía, o la orden cambió de estado en otro dispositivo. Actualiza e intenta de nuevo.',
};

const INTERVALO_PEDIDOS_MS = 30_000;
const ESTADOS_PEDIDO_EN_CURSO: readonly string[] = ['SOLICITADO', 'ASIGNADO', 'DESPACHADO'];

/** B3 — Technician execution: travel, arrival, diagnosis and closure. */
@Component({
  selector: 'app-ejecucion-ot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonRefresher,
    RecargarDirective,
    ContenidoRecargaComponent,
    IonFooter,
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTextarea,
    IonToolbar,
  ],
  templateUrl: './ejecucion-ot.page.html',
})
export class EjecucionOtPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly otApi = inject(OtApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly presencia = inject(TecnicoPresenciaService);
  private readonly sse = inject(SseService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(MobileToastService);
  private readonly catalogo = inject(CatalogoInsumosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  private cargaOtEstado: CargaOtEstado | null = null;
  private suscripcionRespaldo: Subscription | null = null;

  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly enSitio = signal(false);
  /** Evita que un doble toque envíe dos veces el mismo paso. */
  readonly enviandoPaso = signal(false);
  readonly enviandoDiagnostico = signal(false);
  readonly finalizando = signal(false);
  readonly insumosOt = signal<SolicitudInsumoResponse[]>([]);
  /** Reloj de la pantalla: sin él el aviso de ETA vencido no aparecería solo. */
  private readonly ahora = signal(Date.now());
  /** Pedidos en los que el técnico eligió seguir esperando (solo en esta pantalla). */
  readonly avisosPlegados = signal<ReadonlySet<string>>(new Set());
  readonly confirmandoCambio = signal<string | null>(null);
  readonly cambiandoProveedor = signal<string | null>(null);
  readonly medioPagoCierre = signal<MedioPago>('EFECTIVO');

  readonly visitaPagada = computed(() => this.ot()?.visitaPagada === true);
  readonly desplazamientoBloqueadoPorPago = computed(
    () => this.ot()?.estado === 'ASIGNADA' && this.ot()?.visitaPagada === false,
  );
  /**
   * El presupuesto ya se mandó y el cliente todavía no responde: la OT sigue en
   * `EN_DIAGNOSTICO` hasta que apruebe (o cancele si lo rechaza), así que el
   * estado solo no alcanza para saber si falta enviar algo.
   */
  readonly presupuestoEnviado = computed(() => {
    const orden = this.ot();
    return orden?.estado === 'EN_DIAGNOSTICO' && !!orden.presupuesto;
  });
  /** El paso en el que va la orden: lo primero que se lee. */
  readonly paso = computed(() => {
    const orden = this.ot();
    switch (orden?.estado) {
      case 'ASIGNADA':
        return this.desplazamientoBloqueadoPorPago() ? 'Visita pendiente de pago' : 'Lista para salir';
      case 'EN_CAMINO':
        return this.enSitio() ? 'Diagnóstico' : 'En camino';
      case 'EN_DIAGNOSTICO':
        return this.presupuestoEnviado() ? 'Esperando al cliente' : 'Diagnóstico';
      case 'FINALIZADA':
        return 'Servicio finalizado';
      case undefined:
        return '';
      default:
        return ETIQUETA_ESTADO_OT[orden!.estado];
    }
  });

  /** Una sola acción en el pie, la del paso. */
  readonly accionPie = computed<'salir' | 'llegar' | 'diagnostico' | 'finalizar' | 'volver' | null>(
    () => {
      const estado = this.ot()?.estado;
      if (estado === 'ASIGNADA') return 'salir';
      if (estado === 'EN_CAMINO' && !this.enSitio()) return 'llegar';
      if (this.mostrarDiagnostico()) return 'diagnostico';
      if (estado === 'EN_REPARACION') return 'finalizar';
      return estado === 'FINALIZADA' ? 'volver' : null;
    },
  );

  /** Visita estimada mientras la orden no la tenga registrada (se fija al cerrar). */
  private readonly visitaEstimada = signal<number | null>(null);
  private readonly visita = computed(() => this.ot()?.tarifaVisita ?? this.visitaEstimada());

  /** `true` cuando el total mostrado ya incluye la visita. */
  readonly incluyeVisita = computed(() => this.visita() !== null);

  /** Presupuesto más visita; sin presupuesto no se afirma un valor. */
  readonly valorACobrar = computed<number | null>(() => {
    const orden = this.ot();
    if (!orden?.presupuesto) return null;
    return orden.presupuesto.total + (this.visita() ?? 0);
  });

  /** Comisión de la plataforma: 15 % de lo cobrado (la calcula y registra el servidor). */
  readonly comision = computed(() => Math.round((this.valorACobrar() ?? 0) * 0.15));

  /** La misma tarifa que usa el servidor al cerrar, pedida al llegar al cierre. */
  private estimarVisita(): void {
    const orden = this.ot();
    const punto = orden?.punto;
    if (orden?.estado !== 'EN_REPARACION' || orden.tarifaVisita != null || !punto) return;
    this.otApi.estimarTarifa(punto).subscribe({
      next: (estimacion) =>
        this.visitaEstimada.set(estimacion.fueraDeRango ? null : estimacion.tarifa),
      error: () => this.visitaEstimada.set(null),
    });
  }

  readonly mostrarDiagnostico = computed(() => {
    const estado = this.ot()?.estado;
    if (this.presupuestoEnviado()) return false;
    return estado === 'EN_DIAGNOSTICO' || (estado === 'EN_CAMINO' && this.enSitio());
  });

  readonly diagnosticoForm = new FormGroup({
    diagnostico: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    manoDeObra: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    repuestos: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  readonly insumos = new FormArray<FormGroup>([]);

  /** Búsqueda rápida en el catálogo (mock aprobado hasta que exista el endpoint). */
  readonly busquedaInsumo = signal('');
  readonly resultadosCatalogo = computed<ProductoCatalogo[]>(() =>
    this.catalogo.buscar(this.busquedaInsumo(), this.ot()?.categoriaServicio),
  );
  readonly busquedaActiva = computed(() => this.busquedaInsumo().trim().length >= 2);

  /** Intento de envío: hace visibles los campos faltantes (antes el botón
   * fallaba en silencio y parecía muerto). */
  readonly intentoEnvio = signal(false);
  readonly formularioIncompleto = computed(() => {
    if (!this.intentoEnvio()) return false;
    return this.diagnosticoForm.invalid || this.insumos.invalid;
  });

  /**
   * Valor vivo del formulario: los FormGroup no son signals, así que sin este
   * espejo el total computado nunca se invalidaba al escribir (medido en el
   * walkthrough: el presupuesto no reaccionaba).
   */
  private readonly valorDiagnostico = signal(this.diagnosticoForm.getRawValue());

  readonly totalPresupuesto = computed<number>(() => {
    const valor = this.valorDiagnostico();
    return (valor.manoDeObra ?? 0) + (valor.repuestos ?? 0);
  });

  constructor() {
    this.diagnosticoForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.valorDiagnostico.set(this.diagnosticoForm.getRawValue()));
    effect(() => this.presencia.sincronizarOt(this.ot()));
    // Solo cuando cambia la orden o su estado: no en cada recarga del mismo punto.
    const claveCierre = computed(() => {
      const orden = this.ot();
      return orden?.estado === 'EN_REPARACION' ? orden.id : null;
    });
    effect(() => {
      if (claveCierre()) untracked(() => this.estimarVisita());
    });
  }

  /** Deslizar: orden e insumos; el formulario no se toca. */
  readonly recargar = (): Observable<unknown> => {
    // Con la carga inicial fallida, deslizar es reintentar: así se quita el aviso.
    if (this.otErrorCarga()) {
      this.reintentarCargaOt();
      return of(null);
    }
    return forkJoin([
      this.otApi.getOtById(this.otId()),
      // Como en la carga inicial: sin insumos la orden se actualiza igual.
      this.tecnicosApi.getInsumosOt(this.otId()).pipe(catchError(() => of(this.insumosOt()))),
    ]).pipe(
      tap(([orden, insumos]) => {
        this._otRemoto.set(orden);
        this.ahora.set(Date.now());
        this.insumosOt.set(insumos);
      }),
    );
  };

  ngOnInit(): void {
    // Aparte del respaldo del SSE: los cambios de un pedido no llegan por el stream de la OT.
    pollVisibleTab(INTERVALO_PEDIDOS_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.ahora.set(Date.now());
        if (this.insumosOt().some((pedido) => ESTADOS_PEDIDO_EN_CURSO.includes(pedido.estado))) {
          this.cargarInsumos();
        }
      });
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.escucharCambiosDeEstado(id);
        this.cargarInsumos();
      },
      (orden) => this._otRemoto.set(orden),
    );
  }

  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  cargandoInicial(): boolean {
    return !this.ot() && !this.otErrorCarga();
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => this._otRemoto.set(orden),
      error: () => undefined,
    });
  }

  private escucharCambiosDeEstado(id: string): void {
    this.sse
      .abrirOtStream(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          if (payload.otId !== this.otId()) return;
          this.recargarOt();
        },
        error: () => this.iniciarPollDeRespaldo(),
        // En mock el stream llega VACÍO y completa sin error: sin este cierre
        // el poll de respaldo jamás arrancaba y la pantalla nunca refrescaba.
        complete: () => this.iniciarPollDeRespaldo(),
      });
  }

  private iniciarPollDeRespaldo(): void {
    if (this.suscripcionRespaldo) return;
    this.suscripcionRespaldo = pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOt());
  }

  private cargarInsumos(): void {
    this.tecnicosApi.getInsumosOt(this.otId()).subscribe({
      next: (insumos) => {
        this.ahora.set(Date.now());
        this.insumosOt.set(insumos);
      },
      error: () => undefined,
    });
  }

  /** Aceptado, sin despachar y con el tiempo prometido ya cumplido. El servidor lo vuelve a validar. */
  etaVencido(pedido: SolicitudInsumoResponse): boolean {
    const estadoOt = this.ot()?.estado;
    return (
      estadoOt !== 'FINALIZADA' &&
      estadoOt !== 'CANCELADA' &&
      pedido.estado === 'ASIGNADO' &&
      !!pedido.etaMinutos &&
      !!pedido.aceptadaEn &&
      this.ahora() >= Date.parse(pedido.aceptadaEn) + pedido.etaMinutos * 60_000
    );
  }

  minutosTranscurridos(pedido: SolicitudInsumoResponse): number {
    return pedido.aceptadaEn ? Math.floor((this.ahora() - Date.parse(pedido.aceptadaEn)) / 60_000) : 0;
  }

  seguirEsperando(pedido: SolicitudInsumoResponse): void {
    this.confirmandoCambio.set(null);
    this.avisosPlegados.update((plegados) => new Set(plegados).add(pedido.id));
  }

  cambiarProveedor(pedido: SolicitudInsumoResponse): void {
    if (this.cambiandoProveedor()) return;
    this.cambiandoProveedor.set(pedido.id);
    this.tecnicosApi.cambiarProveedorInsumo(pedido.id).subscribe({
      next: () => {
        // Es el mismo pedido con otro proveedor: su aviso empieza completo.
        this.avisosPlegados.update((plegados) => new Set([...plegados].filter((id) => id !== pedido.id)));
        this.terminarCambio();
        void this.toast.success(
          'Buscando otro proveedor',
          'El pedido se ofreció de nuevo a los proveedores cercanos.',
        );
      },
      error: (err: unknown) => {
        this.terminarCambio();
        // En un 409 el servidor dice por qué (ya despachó, o todavía no vence).
        const motivo =
          err instanceof ApiHttpError && err.status === 409 ? err.message : mensajeErrorAccion(err);
        void this.toast.error('No se pudo cambiar de proveedor', motivo);
      },
    });
  }

  private terminarCambio(): void {
    this.cambiandoProveedor.set(null);
    this.confirmandoCambio.set(null);
    this.cargarInsumos();
  }

  iniciarDesplazamiento(): void {
    if (this.desplazamientoBloqueadoPorPago()) {
      void this.toast.info(
        'Visita pendiente de pago',
        'El cliente debe pagar la visita antes de que puedas iniciar el desplazamiento.',
      );
      return;
    }
    if (this.enviandoPaso()) return;
    this.enviandoPaso.set(true);
    this.tecnicosApi.iniciarDesplazamiento(this.otId()).pipe(finalize(() => this.enviandoPaso.set(false))).subscribe({
      next: () => {
        void this.toast.info('En camino', 'El cliente puede rastrear tu trayecto en vivo.');
        this.recargarOt();
      },
      error: (err: Error) =>
        void avisarErrorAccion(
          this.toast,
          'No se pudo iniciar el desplazamiento',
          err,
          MENSAJES_DESPLAZAMIENTO,
        ),
    });
  }

  llegarADomicilio(): void {
    if (this.enviandoPaso()) return;
    this.enviandoPaso.set(true);
    this.tecnicosApi.llegarADomicilio(this.otId()).pipe(finalize(() => this.enviandoPaso.set(false))).subscribe({
      next: () => {
        this.enSitio.set(true);
        this.recargarOt();
        void this.toast.success('Llegada registrada', 'Registra el diagnóstico y el presupuesto.');
      },
      error: (err: Error) =>
        void avisarErrorAccion(this.toast, 'No se pudo registrar la llegada', err),
    });
  }

  agregarInsumo(): void {
    this.insumos.push(
      new FormGroup({
        descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        cantidad: new FormControl(1, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1)],
        }),
      }),
    );
  }

  quitarInsumo(index: number): void {
    this.insumos.removeAt(index);
  }

  buscarInsumo(valor: unknown): void {
    this.busquedaInsumo.set(typeof valor === 'string' ? valor : '');
  }

  /** Agrega la línea del catálogo con cantidad 1; el técnico ajusta después. */
  agregarDesdeCatalogo(producto: ProductoCatalogo): void {
    this.insumos.push(
      new FormGroup({
        descripcion: new FormControl(producto.nombre, {
          nonNullable: true,
          validators: [Validators.required],
        }),
        cantidad: new FormControl(1, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1)],
        }),
      }),
    );
    this.busquedaInsumo.set('');
  }

  enviarDiagnostico(): void {
    if (this.diagnosticoForm.invalid || this.insumos.invalid) {
      // El fallo nunca es silencioso: se marcan los campos y se explica qué falta.
      this.intentoEnvio.set(true);
      this.diagnosticoForm.markAllAsTouched();
      this.insumos.controls.forEach((grupo) => grupo.markAllAsTouched());
      void this.toast.warning(
        'Faltan datos del diagnóstico',
        'Completa el diagnóstico, la mano de obra y los repuestos (y cada insumo con su cantidad) antes de enviar.',
      );
      return;
    }
    if (this.enviandoDiagnostico()) return;
    this.intentoEnvio.set(false);

    const valor = this.diagnosticoForm.getRawValue();
    const insumos = this.insumos.controls.map((grupo) => {
      const linea = grupo.getRawValue() as { descripcion: string; cantidad: number };
      return { descripcion: linea.descripcion.trim(), cantidad: linea.cantidad };
    });

    this.enviandoDiagnostico.set(true);
    this.tecnicosApi
      .registrarDiagnostico(this.otId(), {
        diagnostico: valor.diagnostico.trim(),
        manoDeObra: valor.manoDeObra ?? undefined,
        repuestos: valor.repuestos ?? undefined,
        insumos,
      })
      .subscribe({
        next: () => {
          this.enviandoDiagnostico.set(false);
          this.insumos.clear();
          this.diagnosticoForm.reset();
          this.recargarOt();
          void this.toast.success(
            'Presupuesto notificado',
            'El cliente recibió la cotización para su aprobación.',
          );
        },
        error: (err: Error) => {
          this.enviandoDiagnostico.set(false);
          void avisarErrorAccion(this.toast, 'No se pudo enviar el diagnóstico', err);
        },
      });
  }

  finalizarServicio(): void {
    if (this.finalizando()) return;
    this.finalizando.set(true);
    this.tecnicosApi.finalizarServicio(this.otId(), this.medioPagoCierre()).subscribe({
      next: () => {
        this.finalizando.set(false);
        this.presencia.liberarContexto();
        this.recargarOt();
        void this.toast.success('Servicio finalizado', 'Consigna la comisión en Gestión para volver a recibir órdenes.');
      },
      error: (err: Error) => {
        this.finalizando.set(false);
        void avisarErrorAccion(this.toast, 'No se pudo finalizar el servicio', err);
      },
    });
  }

  irAlPanel(): void {
    void this.router.navigate(['/tecnico/ots']);
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }

  etiquetaInsumo(estado: string): string {
    switch (estado) {
      case 'SOLICITADO':
        return 'Solicitado';
      case 'ASIGNADO':
        return 'Asignado';
      case 'DESPACHADO':
        return 'Despachado';
      case 'ENTREGADO':
        return 'Entregado';
      case 'SIN_PROVEEDOR':
        return 'Sin proveedor';
      default:
        return estado;
    }
  }
}
