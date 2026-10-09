import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, startWith, switchMap, Subscription } from 'rxjs';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../core/service/ot-api';
import { calcularRuta, cargarOtDesdeRuta, otDesdeFuente } from '../../core/service/ot-carga';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { MapsApi } from '../../core/service/maps-api';
import { SseService } from '../../core/service/sse.service';
import { ToastService } from '../../core/alertas/toast.service';
import { OtTimeline } from '../../shared/ot-timeline/ot-timeline';
import { MapaRadar } from '../../shared/mapa-radar/mapa-radar';
import { CargoVisitaDiagnostico } from '../../shared/cargo-visita/cargo-visita';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtResponse, Point, TecnicoCercano, MedioPago, EstadoOt } from '../../core/models/common.models';

/**
 * Estados en los que el técnico asignado debería estar desplazándose. Es la
 * misma lista que gobierna el cargo de visita: mientras la OT no esté aquí, la
 * última posición conocida ya no aporta nada al seguimiento.
 */
const ESTADOS_TECNICO_EN_MOVIMIENTO: readonly EstadoOt[] = [
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
];

@Component({
  selector: 'app-seguimiento-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    OtTimeline,
    MapaRadar,
    CargoVisitaDiagnostico,
    EstadoBadge
  ],
  templateUrl: './seguimiento-ot-page.html'
})
export class SeguimientoOtPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly mapsApi = inject(MapsApi);
  private readonly sse = inject(SseService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** En mock lee del MockDb (reactivo); contra el backend usa la OT cargada por API. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly tecnicoUbicacion = signal<Point | null>(null);
  readonly distanciaKm = signal<number | null>(null);
  readonly etaMin = signal<number | null>(null);
  readonly tecnicosCercanos = signal<TecnicoCercano[]>([]);

  /** Sondeo de la última posición del técnico; `null` cuando no aplica. */
  private suscripcionSeguimiento: Subscription | null = null;

  /** Muestra el cargo de visita + diagnóstico desde que hay técnico asignado. */
  readonly mostrarCargoVisita = computed<boolean>(() => {
    const orden = this.ot();
    if (!orden?.tecnicoId) return false;
    return ESTADOS_TECNICO_EN_MOVIMIENTO.includes(orden.estado);
  });

  readonly mostrarModalCancelar = signal<boolean>(false);
  readonly motivoControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });
  readonly mostrarModalDisputa = signal<boolean>(false);
  readonly motivoDisputaControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  /** RF-F1-26: medio de pago de la visita y estado de la petición. */
  readonly medioPagoVisita = signal<MedioPago>('EFECTIVO');
  readonly pagandoVisita = signal<boolean>(false);

  /**
   * El pago de la visita solo aplica cuando el presupuesto quedó rechazado:
   * `CANCELADA` contra el backend real y `DISPUTADA` en el MockDb.
   */
  readonly puedePagarVisita = computed<boolean>(() => {
    const estado = this.ot()?.estado;
    return estado === 'CANCELADA' || estado === 'DISPUTADA';
  });

  ngOnInit(): void {
    cargarOtDesdeRuta(
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
        this.cargarTecnicosCercanos();
      },
    );
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => {
        this._otRemoto.set(orden);
        // El estado pudo cambiar (p. ej. una disputa saca a la OT del
        // seguimiento): reevalúa el sondeo con la orden recién cargada.
        this.iniciarSeguimientoTecnico(this.otId());
        this.recalcularDistancia();
        this.cargarTecnicosCercanos();
      },
    });
  }

  /**
   * Actualización en vivo: el backend empuja cada cambio de estado por SSE y acá
   * se recarga la OT. Es solo una mejora: si el stream no está disponible (mock,
   * SSR o caída de red) la página sigue funcionando con la recarga manual, por
   * eso un fallo se silencia en vez de avisar al usuario.
   */
  private escucharCambiosDeEstado(id: string): void {
    this.sse
      .abrirOtStream(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          // Solo reacciona al cambio de la orden que se está viendo.
          if (payload.otId === this.otId()) this.recargarOt();
        },
        error: () => {
          // El stream es un extra: nunca rompe ni alerta a la página.
        },
      });
  }

  /** Técnicos disponibles dentro del radio de búsqueda para el radar. */
  private cargarTecnicosCercanos(): void {
    const orden = this.ot();
    if (!orden?.punto) {
      this.tecnicosCercanos.set([]);
      return;
    }
    this.tecnicosApi
      .getTecnicosCercanos(orden.punto, orden.radioBusquedaKm || 10, orden.categoriaServicio)
      .subscribe({
        next: (tecnicos) => this.tecnicosCercanos.set(tecnicos),
        error: () => this.tecnicosCercanos.set([]),
      });
  }

  /** Sondea la ubicación del técnico asignado y recalcula distancia/ETA. */
  private iniciarSeguimientoTecnico(id: string): void {
    // La OT se carga de forma asíncrona, así que este método se invoca tanto
    // cuando entra el id como cuando llega la orden: es idempotente y reacciona
    // a los dos órdenes posibles.
    const debe = this.mostrarCargoVisita();
    if (!debe) {
      // Sin técnico asignado o en un estado donde nadie se está moviendo:
      // `GET /api/ot/{id}/tecnico-ubicacion` responde 404. Se deja la última
      // posición conocida tal como está y no se sondea.
      this.detenerSeguimientoTecnico();
      return;
    }
    if (this.suscripcionSeguimiento) return;

    this.suscripcionSeguimiento = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => this.otApi.getTecnicoUbicacion(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ubicacion) => {
        this.tecnicoUbicacion.set(ubicacion);
        this.recalcularDistancia();
      });
  }

  private detenerSeguimientoTecnico(): void {
    this.suscripcionSeguimiento?.unsubscribe();
    this.suscripcionSeguimiento = null;
  }

  private recalcularDistancia(): void {
    calcularRuta(
      this.mapsApi,
      this.tecnicoUbicacion(),
      this.ot()?.punto,
      (ruta) => {
        this.distanciaKm.set(ruta.distanciaKm);
        this.etaMin.set(ruta.duracionMin);
      },
      // El backend puede tener Google Maps deshabilitado (503): no romper la vista.
      () => {
        this.distanciaKm.set(null);
        this.etaMin.set(null);
      },
    );
  }

  puedeCancelar(): boolean {
    const estado = this.ot()?.estado;
    return estado === 'SOLICITADA' || estado === 'BUSCANDO_TECNICO' || estado === 'ASIGNADA' || estado === 'EN_CAMINO' || estado === 'EN_DIAGNOSTICO';
  }

  actualizarRadio(nuevoRadio: number): void {
    if (this.apiConfig.useMocks()) {
      const id = this.otId();
      this.mockDb.ordenesTrabajo.update(list =>
        list.map(o => (o.id === id ? { ...o, radioBusquedaKm: nuevoRadio } : o))
      );
    } else {
      this._otRemoto.update(orden => (orden ? { ...orden, radioBusquedaKm: nuevoRadio } : orden));
    }
    this.cargarTecnicosCercanos();
    this.toast.info('Radio Expandido', `Búsqueda ampliada a ${nuevoRadio} km en Cúcuta.`);
  }

  confirmarCancelacion(): void {
    if (this.motivoControl.invalid) return;

    const motivo = this.motivoControl.value;
    this.clientesApi.cancelarOt(this.otId(), motivo).subscribe({
      next: () => {
        this.mostrarModalCancelar.set(false);
        this.toast.warning('Servicio Cancelado', 'La orden de trabajo ha sido cancelada.');
        this.router.navigate(['/panel']);
      }
    });
  }

  confirmarDisputa(): void {
    if (this.motivoDisputaControl.invalid) return;

    this.clientesApi.abrirDisputa(this.otId(), this.motivoDisputaControl.value).subscribe({
      next: () => {
        this.mostrarModalDisputa.set(false);
        this.toast.warning('Disputa Abierta', 'Un administrador revisará tu caso.');
        this.recargarOt();
      },
      error: (err: Error) => this.toast.error('No se pudo abrir la disputa', err.message),
    });
  }

  /** RF-F1-26: paga la tarifa de visita y reabre el despacho. */
  pagarVisita(): void {
    if (this.pagandoVisita()) return;

    this.pagandoVisita.set(true);
    this.clientesApi.pagarVisita(this.otId(), this.medioPagoVisita()).subscribe({
      next: () => {
        this.pagandoVisita.set(false);
        this.toast.success('Visita Pagada', 'Despacho reabierto: buscando un técnico disponible.');
        this.recargarOt();
      },
      error: (err: Error) => {
        this.pagandoVisita.set(false);
        this.toast.error('No se pudo pagar la visita', err.message);
      },
    });
  }
}
