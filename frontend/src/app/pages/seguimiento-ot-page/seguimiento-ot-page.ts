import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, startWith, switchMap } from 'rxjs';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../modules/ot/infrastructure/ot-api';
import { calcularRuta, cargarOtDesdeRuta, otDesdeFuente } from '../../modules/ot/infrastructure/ot-carga';
import { TecnicosApi } from '../../modules/tecnicos/infrastructure/tecnicos-api';
import { MapsApi } from '../../core/service/maps-api';
import { ToastService } from '../../core/alertas/toast.service';
import { OtTimeline } from '../../shared/ot-timeline/ot-timeline';
import { MapaRadar } from '../../shared/mapa-radar/mapa-radar';
import { CargoVisitaDiagnostico } from '../../shared/cargo-visita/cargo-visita';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtResponse, Point, TecnicoCercano, MedioPago } from '../../core/models/common.models';

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

  /** Muestra el cargo de visita + diagnóstico desde que hay técnico asignado. */
  readonly mostrarCargoVisita = computed<boolean>(() => {
    const orden = this.ot();
    if (!orden?.tecnicoId) return false;
    return ['ASIGNADA', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(orden.estado);
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
      },
      (orden) => {
        this._otRemoto.set(orden);
        this.recalcularDistancia();
        this.cargarTecnicosCercanos();
      },
    );
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => {
        this._otRemoto.set(orden);
        this.recalcularDistancia();
        this.cargarTecnicosCercanos();
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
    interval(15000)
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
