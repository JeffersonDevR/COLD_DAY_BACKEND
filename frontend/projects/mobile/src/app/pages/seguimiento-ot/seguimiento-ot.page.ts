import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of, startWith, switchMap, Subscription } from 'rxjs';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { ApiConfig } from '@core/service/api.config';
import { MockDbService } from '@core/service/mock-db.service';
import { ClientesApi } from '@core/service/clientes-api';
import { OtApi } from '@core/service/ot-api';
import { cargarOtDesdeRuta, otDesdeFuente, CargaOtEstado } from '@core/service/ot-carga';
import { rutaLocal } from '@core/service/distancia-local';
import { pollVisibleTab, tabVisible } from '@core/service/visible-tab-polling';
import {
  ESTADOS_TECNICO_EN_MOVIMIENTO,
  RutaSeguimientoService,
} from '@core/service/ruta-seguimiento.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { SseService } from '@core/service/sse.service';
import { EstadoOt, MedioPago, OtResponse, Point } from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';
import { MapaSeguimientoComponent } from './mapa-seguimiento.component';
import { OtTimelineComponent } from './ot-timeline.component';

/**
 * A6 — Seguimiento de la orden de trabajo (cliente).
 *
 * La web es la fuente del comportamiento; acá se porta el mismo contrato con
 * dos diferencias deliberadas:
 *
 * - Sin radar: con SOLICITADA/BUSCANDO_TECNICO se muestra una tarjeta clara de
 *   "Buscando técnico…"; no se piden técnicos cercanos ni se dibuja mapa.
 * - Sin estimación de tarifa embebida (la calcula POST /api/ot/tarifa/estimar):
 *   el panel de pago muestra los medios y el copy, no el monto estimado.
 *
 * Todo lo demás se replica: carga con banner + Reintentar, SSE con fallback a
 * poll de 25 s, sondeo de posición de 15 s solo con la app visible (404 = sin
 * posición todavía; otros errores conservan el último punto), ruta por calles
 * con guarda de costo (60 s / 200 m) vía `RutaSeguimientoService`, distancia y
 * ETA locales (haversine, 25 km/h), pago de visita, cancelación y disputa con
 * modal, y CTAs de Acta/Calificar solo en FINALIZADA.
 */
@Component({
  selector: 'app-seguimiento-ot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    MapaSeguimientoComponent,
    OtTimelineComponent,
  ],
  // Page-scoped: el guarda de costo arranca limpio en cada visita y muere con la pantalla.
  providers: [RutaSeguimientoService],
  templateUrl: './seguimiento-ot.page.html',
})
export class SeguimientoOtPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly sse = inject(SseService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(MobileToastService);
  private readonly destroyRef = inject(DestroyRef);
  /** Guarda de costo de la ruta por calles (no se pide en cada tick de 15 s). */
  private readonly rutaSeguimiento = inject(RutaSeguimientoService);

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** Estado de la carga: el fallo SIEMPRE se ve (con Reintentar). */
  private cargaOtEstado: CargaOtEstado | null = null;

  /** En mock lee del MockDb; contra el backend usa la OT cargada por API. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly tecnicoUbicacion = signal<Point | null>(null);
  /** Geometría real por calles; `null` → el mapa dibuja la recta. */
  readonly rutaCodificada = this.rutaSeguimiento.rutaCodificada.asReadonly();
  readonly distanciaKm = signal<number | null>(null);
  readonly etaMin = signal<number | null>(null);

  /** Sondeo de la posición del técnico; `null` cuando no aplica. */
  private suscripcionSeguimiento: Subscription | null = null;

  /** Poll de respaldo cuando SSE se rinde; `null` mientras el stream está vivo. */
  private suscripcionRespaldo: Subscription | null = null;

  /** Con técnico asignado y en movimiento tiene sentido hablar de mapa y cargo. */
  readonly mostrarSeguimientoActivo = computed<boolean>(() => {
    const orden = this.ot();
    if (!orden?.tecnicoId) return false;
    return ESTADOS_TECNICO_EN_MOVIMIENTO.includes(orden.estado);
  });

  readonly mostrarModalCancelar = signal(false);
  readonly motivoControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5)],
  });
  readonly mostrarModalDisputa = signal(false);
  readonly motivoDisputaControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5)],
  });

  /** RF-F1-26: medio de pago de la visita y estado de la petición. */
  readonly medioPagoVisita = signal<MedioPago>('EFECTIVO');
  readonly pagandoVisita = signal(false);

  /**
   * El pago de la visita aplica cuando la OT quedó CANCELADA/DISPUTADA
   * (presupuesto rechazado; en móvil el backend real responde CANCELADA) y
   * también mientras está ASIGNADA sin pago (WS5): el técnico no puede iniciar
   * el desplazamiento hasta que el cobro quede registrado.
   */
  readonly puedePagarVisita = computed<boolean>(() => {
    const orden = this.ot();
    if (!orden) return false;
    if (orden.estado === 'CANCELADA' || orden.estado === 'DISPUTADA') return true;
    return orden.estado === 'ASIGNADA' && orden.visitaPagada === false;
  });

  /**
   * Pagar una CANCELADA/DISPUTADA reabre el despacho; pagar una ASIGNADA solo
   * habilita el desplazamiento. Gobierna el copy del panel.
   */
  readonly pagoVisitaReabreDespacho = computed<boolean>(() => {
    const estado = this.ot()?.estado;
    return estado === 'CANCELADA' || estado === 'DISPUTADA';
  });

  ngOnInit(): void {
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.iniciarSeguimientoTecnico(id);
        this.escucharCambiosDeEstado(id);
      },
      (orden) => {
        this._otRemoto.set(orden);
        // La orden llegó después del id: reevalúa si el sondeo aplica.
        this.iniciarSeguimientoTecnico(this.otId());
        this.recalcularDistancia();
      },
    );
  }

  /** Copy del fallo de la carga; null mientras no haya fallo. */
  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  /** `true` mientras no hay OT ni error que mostrar (carga inicial en curso). */
  cargandoInicial(): boolean {
    return !this.ot() && !this.otErrorCarga();
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => {
        this._otRemoto.set(orden);
        // El estado pudo cambiar (p. ej. una disputa saca a la OT del
        // seguimiento): reevalúa el sondeo con la orden recién cargada.
        this.iniciarSeguimientoTecnico(this.otId());
        this.recalcularDistancia();
      },
      // Recarga silenciosa (SSE o respaldo): si falla se conserva lo que la
      // pantalla está mostrando; no hay acción del usuario que explicar.
      error: () => undefined,
    });
  }

  /**
   * Actualización en vivo: el backend empuja cada cambio de estado por SSE y
   * se recarga la OT. Es solo una mejora: si el stream se rinde (mock, red
   * caída, reintentos agotados) arranca el poll de respaldo y la página sigue.
   */
  private escucharCambiosDeEstado(id: string): void {
    this.sse
      .abrirOtStream(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          // Solo reacciona al cambio de la orden que se está viendo.
          if (payload.otId !== this.otId()) return;
          this.anunciarMomentoDeLaOrden(payload.destino, payload.visitaPagadaEn);
          this.recargarOt();
        },
        error: () => {
          // El stream es un extra: nunca rompe ni alerta. Si se rinde, el
          // poll de respaldo toma la posta.
          this.iniciarPollDeRespaldo();
        },
      });
  }

  /**
   * Anuncia los momentos que llegan SOLOS, en `info` para no confundirlos con
   * la confirmación de una acción propia. La llegada NO se avisa: la tarjeta
   * del técnico ya lo muestra.
   */
  private anunciarMomentoDeLaOrden(destino: EstadoOt, visitaPagadaEn?: string): void {
    // El pago de la visita no cambia el estado: llega como ASIGNADA con
    // `visitaPagadaEn`. El cliente ya recibió su toast de éxito al pagar.
    if (destino === 'ASIGNADA' && visitaPagadaEn) {
      return;
    }
    if (destino === 'ASIGNADA') {
      this.toast.info(
        'Técnico asignado',
        'Un técnico aceptó tu orden de trabajo. Podés seguir su avance en esta pantalla.',
      );
      return;
    }
    if (destino === 'EN_DIAGNOSTICO') {
      this.toast.info(
        'Presupuesto recibido',
        'El técnico envió el presupuesto de la reparación. Revisalo y aprobalo para continuar.',
      );
    }
  }

  /**
   * Plan B del stream: refresca la OT cada 25 s (solo con la app visible).
   * Idempotente, muere con el componente y nunca corre mientras SSE está vivo.
   */
  private iniciarPollDeRespaldo(): void {
    if (this.suscripcionRespaldo) return;
    this.suscripcionRespaldo = pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOt());
  }

  /** Sondea la posición del técnico asignado y recalcula distancia/ETA. */
  private iniciarSeguimientoTecnico(id: string): void {
    // La OT se carga de forma asíncrona: se invoca al entrar el id y otra vez
    // cuando llega la orden; es idempotente y reacciona a los dos órdenes.
    const debe = this.mostrarSeguimientoActivo();
    if (!debe) {
      // Sin técnico en movimiento el endpoint responde 404: se conserva la
      // última posición conocida y no se sondea.
      this.detenerSeguimientoTecnico();
      return;
    }
    if (this.suscripcionSeguimiento) return;

    // El sondeo solo corre con la app visible: en segundo plano cada tick era
    // una petición gastada (y batería).
    this.suscripcionSeguimiento = pollVisibleTab(15000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.otApi.getTecnicoUbicacion(id).pipe(
            // Un fallo real (sesión vencida, 5xx, sin red) NO es "sin posición"
            // (404 llega como `null`): se conserva el último punto y el sondeo
            // sigue vivo en vez de cortarse para siempre.
            catchError(() => of(this.tecnicoUbicacion())),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ubicacion) => {
        this.tecnicoUbicacion.set(ubicacion);
        this.recalcularDistancia();
        // La ruta por calles se pide acá, pero el guarda decide si se gasta.
        this.actualizarRuta();
      });
  }

  private detenerSeguimientoTecnico(): void {
    this.suscripcionSeguimiento?.unsubscribe();
    this.suscripcionSeguimiento = null;
  }

  /**
   * Pide la ruta real por calles al guarda de costo. Nunca muestra error: un
   * fallo (404/502/503) llega como `null` y el mapa se queda con la recta.
   */
  private actualizarRuta(): void {
    const origen = this.tecnicoUbicacion();
    const destino = this.ot()?.punto;
    if (!origen || !destino) return;
    this.rutaSeguimiento.actualizar(origen, destino, {
      visible: tabVisible(),
      estado: this.ot()?.estado,
    });
  }

  ngOnDestroy(): void {
    // Ninguna petición de ruta sobrevive a la pantalla.
    this.rutaSeguimiento.detener();
  }

  /**
   * Distancia y ETA en el navegador (haversine, 25 km/h). El poll de 15 s NO
   * puede pedir la distancia a Google en cada tick: quemaba cuota.
   */
  private recalcularDistancia(): void {
    const origen = this.tecnicoUbicacion();
    const destino = this.ot()?.punto;
    if (!origen || !destino) {
      this.distanciaKm.set(null);
      this.etaMin.set(null);
      return;
    }
    const ruta = rutaLocal(origen, destino);
    this.distanciaKm.set(ruta.distanciaKm);
    this.etaMin.set(ruta.duracionMin);
  }

  puedeCancelar(): boolean {
    const estado = this.ot()?.estado;
    return (
      estado === 'SOLICITADA' ||
      estado === 'BUSCANDO_TECNICO' ||
      estado === 'ASIGNADA' ||
      estado === 'EN_CAMINO' ||
      estado === 'EN_DIAGNOSTICO'
    );
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): 'ok' | 'curso' | 'espera' | 'cerrada' {
    return tonoEstadoOt(estado);
  }

  /** Rating del técnico si el backend lo trajera; hoy no lo mapea: "Sin rating". */
  ratingTecnico(): string | null {
    const reputacion = this.ot()?.tecnicoReputacion;
    return reputacion == null ? null : reputacion.toFixed(1);
  }

  irA(ruta: string[]): void {
    void this.router.navigateByUrl(ruta.join('/'));
  }

  confirmarCancelacion(): void {
    if (this.motivoControl.invalid) return;

    const motivo = this.motivoControl.value;
    this.clientesApi.cancelarOt(this.otId(), motivo).subscribe({
      next: () => {
        this.mostrarModalCancelar.set(false);
        this.toast.warning(
          'Servicio cancelado',
          'La orden de trabajo quedó cancelada.',
        );
        void this.router.navigateByUrl('/cliente/panel');
      },
      // El modal queda abierto con el motivo escrito para que reintente.
      error: (err: unknown) => {
        avisarErrorAccion(this.toast, 'No se pudo cancelar el servicio', err);
      },
    });
  }

  confirmarDisputa(): void {
    if (this.motivoDisputaControl.invalid) return;

    this.clientesApi.abrirDisputa(this.otId(), this.motivoDisputaControl.value).subscribe({
      next: () => {
        this.mostrarModalDisputa.set(false);
        this.toast.warning('Disputa abierta', 'Un administrador revisará tu caso.');
        this.recargarOt();
      },
      error: (err: unknown) => avisarErrorAccion(this.toast, 'No se pudo abrir la disputa', err),
    });
  }

  /** RF-F1-26: paga la tarifa de visita y reabre el despacho. */
  pagarVisita(): void {
    if (this.pagandoVisita()) return;

    this.pagandoVisita.set(true);
    this.clientesApi.pagarVisita(this.otId(), this.medioPagoVisita()).subscribe({
      next: () => {
        this.pagandoVisita.set(false);
        const mensaje = this.pagoVisitaReabreDespacho()
          ? 'Despacho reabierto: buscando un técnico disponible.'
          : 'Ya puede iniciar el desplazamiento.';
        this.toast.success('Visita pagada', mensaje);
        this.recargarOt();
      },
      error: (err: unknown) => {
        this.pagandoVisita.set(false);
        avisarErrorAccion(this.toast, 'No se pudo pagar la visita', err);
      },
    });
  }

  /** Abre el modal de cancelación con el motivo limpio. */
  abrirModalCancelar(): void {
    this.motivoControl.setValue('');
    this.motivoControl.markAsUntouched();
    this.mostrarModalCancelar.set(true);
  }

  /** Abre el modal de disputa con el motivo limpio. */
  abrirModalDisputa(): void {
    this.motivoDisputaControl.setValue('');
    this.motivoDisputaControl.markAsUntouched();
    this.mostrarModalDisputa.set(true);
  }

  /** Feedback de los formularios modales sin repetir el copy en cada botón. */
  ayudaMotivo(control: FormControl<string>): string | null {
    if (control.pristine || !control.invalid) return null;
    return 'El motivo debe tener al menos 5 caracteres.';
  }
}
