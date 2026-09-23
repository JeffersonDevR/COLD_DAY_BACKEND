import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, startWith, switchMap } from 'rxjs';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtTimeline } from '../../ot/components/ot-timeline';
import { MapaRadar } from '../../ot/components/mapa-radar';
import { CargoVisitaDiagnostico } from '../../ot/components/cargo-visita';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { OtResponse, Point, TecnicoCercano } from '../../../core/shared/domain/models/common.models';

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
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-5xl mx-auto">
        <!-- Top header con ID y volver -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a routerLink="/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
              <i class="pi pi-arrow-left text-xs"></i> Volver al Panel
            </a>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                OT: {{ orden.id }}
              </h1>
              <app-estado-badge [estado]="orden.estado" />
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Creada el {{ orden.fechaCreacion | date:'medium' }} • {{ orden.barrio || orden.direccion }}
            </p>
          </div>

          <!-- Acciones Contextuales -->
          <div class="flex items-center gap-2">
            @if (orden.estado === 'EN_DIAGNOSTICO' && orden.diagnostico) {
              <a
                [routerLink]="['/cliente/ot', orden.id, 'diagnostico']"
                class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors animate-bounce"
              >
                <i class="pi pi-comment text-sm"></i>
                Revisar Presupuesto ($ {{ (orden.presupuesto?.total || 0).toLocaleString('es-CO') }})
              </a>
            }

            @if (orden.estado === 'FINALIZADA') {
              <a
                [routerLink]="['/cliente/ot', orden.id, 'pago-acta']"
                class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors"
              >
                <i class="pi pi-verified text-sm"></i>
                Ver Acta y Pago
              </a>

              @if (!orden.calificacion) {
                <a
                  [routerLink]="['/cliente/ot', orden.id, 'calificar']"
                  class="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors"
                >
                  <i class="pi pi-star text-sm"></i>
                  Calificar Servicio
                </a>
              }
            }

            <!-- Abrir disputa en fases de diagnóstico/reparación -->
            @if (orden.estado === 'EN_DIAGNOSTICO' || orden.estado === 'EN_REPARACION') {
              <button
                type="button"
                (click)="mostrarModalDisputa.set(true)"
                class="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
              >
                <i class="pi pi-shield text-sm"></i>
                Abrir Disputa
              </button>
            }

            <!-- Botón Cancelar si no está en reparación ni finalizada -->
            @if (puedeCancelar()) {
              <button
                type="button"
                (click)="mostrarModalCancelar.set(true)"
                class="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
              >
                <i class="pi pi-times-circle text-sm"></i>
                Cancelar Solicitud
              </button>
            }
          </div>
        </div>

        <!-- Radar de Búsqueda SVG (si está en SOLICITADA o BUSCANDO_TECNICO) -->
        @if (orden.estado === 'SOLICITADA' || orden.estado === 'BUSCANDO_TECNICO') {
          <app-mapa-radar
            [radioInicial]="orden.radioBusquedaKm || 10"
            [isBuscando]="true"
            [clienteUbicacionNombre]="orden.barrio || 'Tu Ubicación'"
            [centroLat]="orden.punto?.latitud ?? 7.8939"
            [centroLng]="orden.punto?.longitud ?? -72.5078"
            [tecnicosExternos]="tecnicosCercanos()"
            (radioCambiado)="actualizarRadio($event)"
          />
        }

        <!-- Tarjeta de Técnico Asignado (si aplica) -->
        @if (orden.tecnicoId) {
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 flex items-center justify-center font-black text-xl shrink-0">
                {{ orden.tecnicoNombre?.charAt(0) || 'T' }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ orden.tecnicoNombre }}</h3>
                  <span class="inline-flex items-center gap-0.5 text-xs font-bold text-amber-500">
                    <i class="pi pi-star text-xs" style="font-size: 14px; width: 14px; height: 14px;"></i>
                    {{ orden.tecnicoReputacion || 4.9 }}
                  </span>
                </div>
                <p class="text-xs text-slate-500">Técnico Certificado Asignado • Móvil: {{ orden.tecnicoTelefono }}</p>
                <div class="mt-1 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 font-semibold">
                  <i class="pi pi-truck text-xs" style="font-size: 14px; width: 14px; height: 14px;"></i>
                  @if (etaMin() !== null) {
                    <span>En camino a tu ubicación (ETA: ~{{ etaMin() }} min · {{ distanciaKm() }} km)</span>
                  } @else {
                    <span>En camino a tu ubicación</span>
                  }
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <a
                [href]="'tel:' + orden.tecnicoTelefono"
                class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <i class="pi pi-phone text-sm"></i>
                Llamar
              </a>
              <a
                [routerLink]="['/cliente/ot', orden.id, 'diagnostico']"
                class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <i class="pi pi-comments text-sm"></i>
                Chat / Presupuesto
              </a>
            </div>
          </div>
        }

        <!-- Notificación del cargo de visita + diagnóstico (al aceptar el técnico) -->
        @if (mostrarCargoVisita()) {
          <app-cargo-visita [punto]="orden.punto" />
        }

        <!-- Detalle de la Solicitud y Falla -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-6">
            <!-- Timeline de Estados -->
            <app-ot-timeline
              [estadoActual]="orden.estado"
              [historial]="orden.historial || []"
            />

            <!-- Descripción de Falla y Evidencias -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Detalle Técnico Reportado
              </h3>
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ orden.descripcionFalla }}
              </p>

              @if (orden.evidenciaUrls && orden.evidenciaUrls!.length > 0) {
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span class="text-xs font-bold text-slate-500 block mb-2">Evidencia Fotográfica:</span>
                  <div class="flex gap-3 overflow-x-auto pb-2">
                    @for (url of orden.evidenciaUrls; track url) {
                      <img
                        [src]="url"
                        alt="Evidencia técnica de falla"
                        class="w-32 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                        referrerpolicy="no-referrer"
                      />
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Columna Lateral: Resumen del Servicio -->
          <div class="space-y-4">
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Ficha del Servicio
              </h3>

              <div class="space-y-2.5 text-xs">
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Línea:</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200">{{ orden.categoriaServicio.replace('_', ' ') }}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Dirección:</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200 text-right">{{ orden.direccion }}</span>
                </div>
                @if (etaMin() !== null) {
                  <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span class="text-slate-500">Llegada estimada:</span>
                    <span class="font-bold text-sky-600 dark:text-sky-400">{{ etaMin() }} min · {{ distanciaKm() }} km</span>
                  </div>
                }
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Barrio Cúcuta:</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200">{{ orden.barrio || 'Centro' }}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Garantía:</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">90 días tras firma</span>
                </div>
                @if (orden.presupuesto) {
                  <div class="flex justify-between py-2 bg-sky-50 dark:bg-sky-950/40 px-3 rounded-xl">
                    <span class="text-sky-800 dark:text-sky-300 font-semibold">Total Cotizado:</span>
                    <span class="font-extrabold text-sky-900 dark:text-sky-100">$ {{ orden.presupuesto.total.toLocaleString('es-CO') }} COP</span>
                  </div>
                }
              </div>
            </div>

            <!-- Regla de Cancelación Gratuita 10 min -->
            <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div class="flex items-center gap-1.5 font-bold">
                <i class="pi pi-info-circle text-xs"></i>
                Política de Cancelación
              </div>
              <p class="leading-relaxed opacity-90">
                Dispones de 10 minutos de gracia tras la asignación para cancelar sin cargo. No es posible cancelar una vez iniciada la fase de reparación física.
              </p>
            </div>
          </div>
        </div>

        <!-- Modal de Cancelación con Motivo -->
        @if (mostrarModalCancelar()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div class="flex items-center gap-3 text-rose-600">
                <i class="pi pi-times-circle"></i>
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Cancelar Solicitud de OT</h3>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">
                Indica el motivo de la cancelación. Recuerda que solo es admisible antes del inicio de la reparación.
              </p>

              <div>
                <label for="motivoCancel" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de cancelación *
                </label>
                <textarea
                  id="motivoCancel"
                  rows="3"
                  [formControl]="motivoControl"
                  placeholder="Ej. Ya resolví el inconveniente, o debo salir de urgencia de la ciudad..."
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500"
                ></textarea>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  (click)="mostrarModalCancelar.set(false)"
                  class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Volver
                </button>
                <button
                  type="button"
                  [disabled]="motivoControl.invalid"
                  (click)="confirmarCancelacion()"
                  class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                >
                  Confirmar Cancelación
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Modal de Disputa -->
        @if (mostrarModalDisputa()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div class="flex items-center gap-3 text-purple-600">
                <i class="pi pi-shield"></i>
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Abrir Disputa</h3>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">
                Describe la discrepancia (costo, repuestos o calidad). El área administrativa mediará el caso.
              </p>
              <textarea
                rows="3"
                [formControl]="motivoDisputaControl"
                placeholder="Explica el motivo de la disputa..."
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500"
              ></textarea>
              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  (click)="mostrarModalDisputa.set(false)"
                  class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Volver
                </button>
                <button
                  type="button"
                  [disabled]="motivoDisputaControl.invalid"
                  (click)="confirmarDisputa()"
                  class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                >
                  Confirmar Disputa
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `
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
  readonly ot = computed<OtResponse | undefined>(() => {
    if (this.apiConfig.useMocks()) {
      return this.mockDb.ordenesTrabajo().find(o => o.id === this.otId());
    }
    return this._otRemoto();
  });

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

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.otId.set(id);
        this.cargarOt(id);
        this.iniciarSeguimientoTecnico(id);
      }
    });
  }

  private cargarOt(id: string): void {
    this.otApi.getOtById(id).subscribe({
      next: (orden) => {
        this._otRemoto.set(orden);
        this.recalcularDistancia();
        this.cargarTecnicosCercanos();
      },
      error: () => {
        // Sin backend disponible se conserva el estado local (mock).
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
    const origen = this.tecnicoUbicacion();
    const destino = this.ot()?.punto;
    if (!origen || !destino) {
      return;
    }
    this.mapsApi.distancia(origen, destino).subscribe({
      next: (ruta) => {
        this.distanciaKm.set(ruta.distanciaKm);
        this.etaMin.set(ruta.duracionMin);
      },
      // El backend puede tener Google Maps deshabilitado (503): no romper la vista.
      error: () => {
        this.distanciaKm.set(null);
        this.etaMin.set(null);
      },
    });
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
        this.cargarOt(this.otId());
      },
      error: (err: Error) => this.toast.error('No se pudo abrir la disputa', err.message),
    });
  }
}
