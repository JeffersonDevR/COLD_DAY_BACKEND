import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { OtApi } from '../../core/service/ot-api';
import { SseService } from '../../core/service/sse.service';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { cargarOtDesdeRuta, otDesdeFuente } from '../../core/service/ot-carga';
import { rutaLocal } from '../../core/service/distancia-local';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { mensajeErrorAccion } from '../../core/alertas/mensaje-error';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtResponse, MedioPago, EstadoOt, SolicitudInsumoResponse, EstadoRequerimiento, InsumoLinea } from '../../core/models/common.models';

/**
 * Copy propia de esta pantalla: el 409 de `POST /ot/{id}/desplazamiento` es
 * `VisitaNoPagadaException` (WS5), no un conflicto de estado. Refrescar no
 * sirve: el cliente debe pagar la visita antes de que el técnico pueda salir.
 */
const MENSAJES_DESPLAZAMIENTO: Record<number, string> = {
  409: 'No se pudo iniciar el desplazamiento: el cliente puede no haber pagado la visita todavía, o la orden pudo cambiar de estado en otro dispositivo. Actualiza la página e inténtalo de nuevo.',
};

/**
 * Copy propia de esta pantalla: el 409 de `POST /ot/{id}/insumos` es
 * `SolicitudInsumosInvalidaException`, que casi siempre significa que la orden
 * llegó a un estado terminal mientras se redactaba la petición. Refrescar sí
 * sirve acá: la lista vuelve del GET y el form se bloquea.
 */
const MENSAJES_REPUESTOS: Record<number, string> = {
  409: 'La orden cambió de estado y ya no acepta repuestos nuevos. Actualiza la página para ver el estado actual.',
};

/**
 * Estados de la OT en los que el técnico puede pedir repuestos
 * (roadmap 2.4): espeja la guarda del backend (`SolicitarInsumosOtUseCase`).
 * Fuera de este set el backend siempre respondería 409, así que la UI no
 * muestra el form para no montar un envío garantizado a fallar.
 */
const ESTADOS_REPUESTOS_PERMITIDOS = new Set<EstadoOt>([
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
  'DISPUTADA',
]);

@Component({
  selector: 'app-ejecucion-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge],
  templateUrl: './ejecucion-ot-page.html',
})
export class EjecucionOtPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly mockDb = inject(MockDbService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly tracking = inject(TecnicoTrackingService);
  private readonly otApi = inject(OtApi);
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly toast = inject(ToastService);
  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** Suscripción al stream de cambios de estado; se corta al destruir la página. */
  private suscripcionEstado: Subscription | null = null;

  /** Poll de respaldo: `null` mientras el stream SSE está vivo. */
  private suscripcionRespaldo: Subscription | null = null;

  /** En mock lee del MockDb (reactivo); contra el backend usa la OT cargada por API. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly medioPagoCierre = signal<MedioPago>('EFECTIVO');
  readonly distanciaKm = signal<number | null>(null);
  readonly etaMin = signal<number | null>(null);
  /** Marca local: el técnico confirmó llegada y se habilita el diagnóstico. */
  readonly enSitio = signal<boolean>(false);

  /** WS5: el backend reporta si la visita ya fue cobrada. */
  readonly visitaPagada = computed<boolean>(() => this.ot()?.visitaPagada === true);

  /**
   * WS5: la visita debe estar pagada para iniciar el desplazamiento. Solo se
   * bloquea cuando el servidor afirma explícitamente `false`; si el campo no
   * viaja (mock/legacy) no se bloquea, porque la guarda autoritativa es el 409
   * del backend y la UI no debe inventar un bloqueo que el servidor no impone.
   */
  readonly desplazamientoBloqueadoPorPago = computed<boolean>(() => {
    const orden = this.ot();
    return orden?.estado === 'ASIGNADA' && orden.visitaPagada === false;
  });

  constructor() {
    /**
     * Recalcula distancia/ETA al cliente cada vez que cambia la posición del
     * técnico.
     *
     * El cálculo es LOCAL (haversine): pedirle la distancia a Distance Matrix
     * en cada tick quemaba cuota de Google (4 llamadas por minuto y por
     * técnico ejecutando). Además Google devolvía la distancia por calle con
     * tráfico, así que el número local es honesto como cota inferior del
     * trayecto, no como el tiempo real de la calle.
     *
     * Sin posición del técnico o sin punto de servicio no se muestra ningún
     * número: mejor sin dato que con un dato falso.
     */
    effect(() => {
      const origen = this.tracking.ultimaPosicion();
      const destino = this.ot()?.punto;
      if (!origen || !destino) {
        this.distanciaKm.set(null);
        this.etaMin.set(null);
        return;
      }
      const ruta = rutaLocal(origen, destino);
      this.distanciaKm.set(ruta.distanciaKm);
      this.etaMin.set(ruta.duracionMin);
    });
  }

  readonly diagnosticoForm = new FormGroup({
    diagnostico: new FormControl('Condensador con suciedad severa y capacitor desvalorizado. Requiere lavado químico y reemplazo de capacitor 45uF.', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    manoDeObra: new FormControl(80000, { nonNullable: true, validators: [Validators.required] }),
    repuestos: new FormControl(70000, { nonNullable: true, validators: [Validators.required] }),
    tiempoEstimadoHoras: new FormControl(2, { nonNullable: true, validators: [Validators.required] })
  });

  /** Líneas de insumo declaradas por el técnico; cero líneas es un caso normal. */
  readonly insumos = new FormArray<FormGroup>([]);

  private nuevaLineaInsumo(): FormGroup {
    return new FormGroup({
      descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      cantidad: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    });
  }

  agregarInsumo(): void {
    this.insumos.push(this.nuevaLineaInsumo());
  }

  quitarInsumo(index: number): void {
    this.insumos.removeAt(index);
  }

  // --- Repuestos a posteriori (roadmap 2.4) ---

  /** Requerimientos de repuestos de la OT, newest first (GET del backend). */
  readonly insumosOt = signal<SolicitudInsumoResponse[]>([]);

  /** Estado de la carga del listado, con copy humana si falló (nunca en blanco). */
  readonly repuestosCargando = signal<boolean>(false);
  readonly repuestosErrorCarga = signal<string | null>(null);
  /** Guard in-flight: evita que un doble clic despache dos broadcasts. */
  readonly repuestosEnviando = signal<boolean>(false);

  /**
   * Form de repuestos a posteriori: mismas líneas libres que el diagnóstico
   * (descripcion + cantidad, AD5) más observaciones opcionales. Vive dentro de
   * la sección "Repuestos" y se envía a POST /api/ot/{id}/insumos.
   */
  readonly repuestosForm = new FormGroup({
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    insumos: new FormArray<FormGroup>([]),
  });

  private nuevaLineaRepuesto(): FormGroup {
    return new FormGroup({
      descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
      cantidad: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    });
  }

  agregarRepuesto(): void {
    this.repuestosForm.controls.insumos.push(this.nuevaLineaRepuesto());
  }

  quitarRepuesto(index: number): void {
    this.repuestosForm.controls.insumos.removeAt(index);
  }

  /**
   * Espeja la guarda de estados del backend: con una OT terminal el POST
   * respondería 409, así que el form ni se muestra.
   */
  readonly repuestosPermitidos = computed<boolean>(() => {
    const estado = this.ot()?.estado;
    return !!estado && ESTADOS_REPUESTOS_PERMITIDOS.has(estado);
  });

  /**
   * Carga el historial de repuestos de la OT. Tolerante: un fallo (403 de otro
   * técnico, 404, red) deja la sección renderizada con el aviso de error y
   * NUNCA deja la página en blanco (clase "loads silenciosos").
   */
  cargarInsumos(): void {
    const id = this.otId();
    if (!id) return;
    this.repuestosCargando.set(true);
    this.repuestosErrorCarga.set(null);
    this.tecnicosApi.getInsumosOt(id).subscribe({
      next: (requerimientos) => {
        this.insumosOt.set(requerimientos);
        this.repuestosCargando.set(false);
      },
      error: () => {
        this.repuestosCargando.set(false);
        this.repuestosErrorCarga.set(
          'No se pudo cargar el historial de repuestos de esta orden. Revisa tu conexión e inténtalo de nuevo.',
        );
      },
    });
  }

  enviarRepuestos(): void {
    const lines = this.repuestosForm.controls.insumos;
    if (this.repuestosForm.invalid || lines.length === 0) return;
    // Un clic doble no puede despachar dos broadcasts a los proveedores.
    if (this.repuestosEnviando()) return;
    this.repuestosEnviando.set(true);

    const insumos: InsumoLinea[] = lines.controls.map((grupo) => {
      const linea = grupo.getRawValue() as { descripcion: string; cantidad: number };
      return { descripcion: linea.descripcion.trim(), cantidad: linea.cantidad };
    });
    const observaciones = this.repuestosForm.controls.observaciones.value.trim();

    this.tecnicosApi.solicitarInsumos(this.otId(), { observaciones: observaciones || undefined, insumos }).subscribe({
      next: (requerimiento) => {
        this.repuestosEnviando.set(false);
        // Actualización en sitio: el GET del backend ya volvió newest first,
        // así que el requerimiento recién creado va al frente de la lista.
        this.insumosOt.update((listaAnterior) => [requerimiento, ...listaAnterior]);
        this.repuestosForm.reset();
        lines.clear();
        // Un requerimiento SIN_PROVEEDOR no es un fallo: se creó, pero nadie
        // lo recibió y el POST puede repetirse.
        if (requerimiento.estado === 'SIN_PROVEEDOR') {
          this.toast.info(
            'Sin proveedores disponibles',
            'Tus repuestos quedaron registrados, pero por ahora no hay proveedores disponibles. Podrás reintentar en unos minutos.',
          );
        } else {
          this.toast.success(
            'Repuestos solicitados',
            'Se despacharon a los proveedores activos. Los verás reflejados en la lista.',
          );
        }
      },
      // El form queda intacto para que el técnico pueda reintentar.
      error: (err) => {
        this.repuestosEnviando.set(false);
        this.toast.error('No se pudieron solicitar los repuestos', mensajeErrorAccion(err, MENSAJES_REPUESTOS));
      },
    });
  }

  etiquetaRepuesto(estado: EstadoRequerimiento): string {
    switch (estado) {
      case 'SOLICITADO': return 'Solicitado';
      case 'ASIGNADO': return 'Asignado';
      case 'ENTREGADO': return 'Entregado';
      case 'SIN_PROVEEDOR': return 'Sin proveedor';
    }
  }

  tonoRepuesto(estado: EstadoRequerimiento): 'pendiente' | 'ok' | 'error' {
    switch (estado) {
      case 'SOLICITADO': return 'pendiente';
      case 'ASIGNADO':
      case 'ENTREGADO': return 'ok';
      case 'SIN_PROVEEDOR': return 'error';
    }
  }

  claseBadgeRepuesto(estado: EstadoRequerimiento): string {
    switch (this.tonoRepuesto(estado)) {
      case 'pendiente': return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
      case 'ok': return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
      case 'error': return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300';
    }
  }

  ngOnInit(): void {
    cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.enSitio.set(false);
        this.escucharCambiosDeEstado(id);
        // Historial de repuestos (roadmap 2.4): tolerante a fallo, nunca en blanco.
        this.cargarInsumos();
      },
      (orden) => this._otRemoto.set(orden),
    );
    // Empuja la ubicación del técnico mientras ejecuta el servicio.
    this.tracking.iniciar();
  }

  ngOnDestroy(): void {
    this.suscripcionEstado?.unsubscribe();
    this.suscripcionEstado = null;
    this.suscripcionRespaldo?.unsubscribe();
    this.suscripcionRespaldo = null;
    this.tracking.detener();
  }

  iniciarDesplazamiento(): void {
    if (this.desplazamientoBloqueadoPorPago()) {
      this.toast.info(
        'Visita pendiente de pago',
        'El cliente debe pagar la visita antes de que puedas iniciar el desplazamiento.',
      );
      return;
    }
    this.tecnicosApi.iniciarDesplazamiento(this.otId()).subscribe({
      next: () => {
        this.toast.info('En Camino', 'El cliente puede rastrear tu trayecto en vivo.');
        this.recargarOt();
      },
      // Sin recargar: la OT sigue en ASIGNADA y el técnico ve por qué no salió.
      error: (err) => {
        this.toast.error('No se pudo iniciar el desplazamiento', mensajeErrorAccion(err, MENSAJES_DESPLAZAMIENTO));
      },
    });
  }

  /**
   * Confirma la llegada: persiste el hecho en el backend
   * (POST /api/ot/{id}/llegada) y habilita localmente el formulario de diagnóstico.
   * El backend no cambia el estado en esta llamada; la OT avanza a EN_DIAGNOSTICO
   * cuando se registra el diagnóstico (POST /api/ot/{id}/diagnostico).
   */
  llegarADomicilio(): void {
    this.tecnicosApi.llegarADomicilio(this.otId()).subscribe({
      next: () => {
        this.enSitio.set(true);
        this.toast.success('Llegada Registrada', 'Registra el diagnóstico y presupuesto del equipo.');
      },
      // El formulario de diagnóstico no se habilita: la llegada no quedó registrada.
      error: (err) => {
        this.toast.error('No se pudo registrar la llegada', mensajeErrorAccion(err));
      },
    });
  }

  enviarDiagnostico(): void {
    if (this.diagnosticoForm.invalid || this.insumos.invalid) return;

    const val = this.diagnosticoForm.getRawValue();
    const insumos = this.insumos.controls.map((grupo) => {
      const linea = grupo.getRawValue() as { descripcion: string; cantidad: number };
      return { descripcion: linea.descripcion.trim(), cantidad: linea.cantidad };
    });

    this.tecnicosApi.registrarDiagnostico(this.otId(), { ...val, insumos }).subscribe({
      next: () => {
        const detalle =
          insumos.length > 0 ? ` Se despacharon ${insumos.length} insumo(s) a los proveedores.` : '';
        this.toast.success('Presupuesto Notificado', `El cliente ha recibido la cotización para su aprobación.${detalle}`);
        this.recargarOt();
      },
      // El formulario queda tal como estaba para que el técnico pueda reintentar.
      error: (err) => {
        this.toast.error('No se pudo enviar el diagnóstico', mensajeErrorAccion(err));
      },
    });
  }

  finalizarServicio(): void {
    this.tecnicosApi.finalizarServicio(this.otId(), this.medioPagoCierre()).subscribe({
      next: () => {
        this.tracking.detener();
        this.recargarOt();
        this.registrarPagoCierre();
      },
      // No se detiene el tracking ni se registra el pago: la OT no se finalizó.
      error: (err) => {
        this.toast.error('No se pudo finalizar el servicio', mensajeErrorAccion(err));
      },
    });
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => this._otRemoto.set(orden),
    });
  }

  /**
   * Actualización en vivo (WS6): el backend empuja cada cambio de estado por SSE
   * y acá se recarga la OT, así la pantalla refleja lo que hizo la otra parte sin
   * recargar a mano. Es solo una mejora: si el stream no está disponible (mock,
   * SSR o caída de red) la página sigue funcionando, por eso un fallo se
   * silencia en vez de avisar al usuario.
   */
  private escucharCambiosDeEstado(id: string): void {
    this.suscripcionEstado?.unsubscribe();
    this.suscripcionEstado = this.sse.abrirOtStream(id).subscribe({
      next: (payload) => {
        // Solo reacciona al cambio de la orden que se está viendo.
        if (payload.otId !== this.otId()) return;
        // Captura el estado previo para no doble-anunciar si ya estaba pagada.
        const yaPagada = this.ot()?.visitaPagada === true;
        this.anunciarAprobacionDelPresupuesto(payload.destino);
        if (payload.visitaPagadaEn && !yaPagada) {
          this.toast.info(
            'Visita pagada',
            'El cliente pagó la visita. Ya podés continuar con el diagnóstico.',
          );
        }
        this.recargarOt();
      },
      error: () => {
        // El stream es un extra: nunca rompe ni alerta a la página. Si se
        // rinde (reintentos agotados), el poll de respaldo toma la posta.
        this.iniciarPollDeRespaldo();
      },
    });
  }

  /**
   * Anuncia la aprobación del presupuesto, que llega SOLA desde el canal de la
   * orden. Los toasts verdes (`success`) son para lo que el técnico acaba de
   * hacer, así que la noticia entrante va en `info`.
   */
  private anunciarAprobacionDelPresupuesto(destino: EstadoOt): void {
    if (destino !== 'EN_REPARACION') return;
    this.toast.info(
      'Presupuesto aprobado',
      'El cliente aprobó tu presupuesto. Ya puedes empezar la reparación.',
    );
  }

  /** Plan B del stream: refresca la OT cada 25 s mientras la pestaña está visible. */
  private iniciarPollDeRespaldo(): void {
    if (this.suscripcionRespaldo) return;
    this.suscripcionRespaldo = pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOt());
  }

  /**
   * Tras finalizar, el técnico registra el monto y el medio cobrados.
   * El backend exige la OT en FINALIZADA y `montoCobrado >= 0.01`.
   */
  private registrarPagoCierre(): void {
    const monto = this.ot()?.presupuesto?.total ?? 0;
    if (monto < 0.01) {
      this.toast.info(
        'Servicio Completado',
        'No se registró el pago: la OT no tiene un monto de presupuesto disponible.'
      );
      return;
    }

    if (this.apiConfig.useMocks()) {
      // En modo mock `finalizarServicio` ya crea la liquidación y bloquea al técnico;
      // llamar a registrarPago generaría una segunda liquidación duplicada.
      this.toast.success(
        'Servicio Completado',
        'Acta de 90 días certificada y liquidación registrada.'
      );
      return;
    }

    this.liquidacionApi.registrarPago(this.otId(), monto, this.medioPagoCierre()).subscribe({
      next: () => {
        this.toast.success(
          'Servicio Completado',
          'Acta de 90 días certificada y liquidación registrada.'
        );
      },
      // La OT ya quedó FINALIZADA; solo falló el registro del pago, así que el
      // aviso lo dice para que el técnico no crea que el cobro se guardó.
      error: (err) => {
        this.toast.error('No se pudo registrar el pago del servicio', mensajeErrorAccion(err));
      },
    });
  }
}
