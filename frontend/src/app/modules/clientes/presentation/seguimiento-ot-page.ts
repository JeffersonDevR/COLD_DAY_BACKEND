import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ClientesApi } from '../infrastructure/clientes-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtTimeline } from '../../ot/components/ot-timeline';
import { MapaRadar } from '../../ot/components/mapa-radar';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-seguimiento-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    MatIconModule,
    ReactiveFormsModule,
    OtTimeline,
    MapaRadar,
    EstadoBadge
  ],
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-5xl mx-auto">
        <!-- Top header con ID y volver -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a routerLink="/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
              <mat-icon class="text-xs">arrow_back</mat-icon> Volver al Panel
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
                <mat-icon class="text-sm">rate_review</mat-icon>
                Revisar Presupuesto ($ {{ (orden.presupuesto?.total || 0).toLocaleString('es-CO') }})
              </a>
            }

            @if (orden.estado === 'FINALIZADA') {
              <a
                [routerLink]="['/cliente/ot', orden.id, 'pago-acta']"
                class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors"
              >
                <mat-icon class="text-sm">verified</mat-icon>
                Ver Acta y Pago
              </a>

              @if (!orden.calificacion) {
                <a
                  [routerLink]="['/cliente/ot', orden.id, 'calificar']"
                  class="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors"
                >
                  <mat-icon class="text-sm">star</mat-icon>
                  Calificar Servicio
                </a>
              }
            }

            <!-- Botón Cancelar si no está en reparación ni finalizada -->
            @if (puedeCancelar()) {
              <button
                type="button"
                (click)="mostrarModalCancelar.set(true)"
                class="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
              >
                <mat-icon class="text-sm">cancel</mat-icon>
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
                    <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">star</mat-icon>
                    {{ orden.tecnicoReputacion || 4.9 }}
                  </span>
                </div>
                <p class="text-xs text-slate-500">Técnico Certificado Asignado • Móvil: {{ orden.tecnicoTelefono }}</p>
                <div class="mt-1 flex items-center gap-2 text-xs text-sky-600 dark:text-sky-400 font-semibold">
                  <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">two_wheeler</mat-icon>
                  <span>En camino a tu ubicación (Tiempo estimado: ~15 min)</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <a
                [href]="'tel:' + orden.tecnicoTelefono"
                class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <mat-icon class="text-sm">call</mat-icon>
                Llamar
              </a>
              <a
                [routerLink]="['/cliente/ot', orden.id, 'diagnostico']"
                class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <mat-icon class="text-sm">chat</mat-icon>
                Chat / Presupuesto
              </a>
            </div>
          </div>
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
                <mat-icon class="text-xs">info</mat-icon>
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
                <mat-icon>cancel</mat-icon>
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
      </div>
    }
  `
})
export class SeguimientoOtPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientesApi = inject(ClientesApi);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly otId = signal<string>('');
  readonly ot = computed<OtResponse | undefined>(() => {
    return this.mockDb.ordenesTrabajo().find(o => o.id === this.otId());
  });

  readonly mostrarModalCancelar = signal<boolean>(false);
  readonly motivoControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.otId.set(id);
      }
    });
  }

  puedeCancelar(): boolean {
    const estado = this.ot()?.estado;
    return estado === 'SOLICITADA' || estado === 'BUSCANDO_TECNICO' || estado === 'ASIGNADA' || estado === 'EN_CAMINO' || estado === 'EN_DIAGNOSTICO';
  }

  actualizarRadio(nuevoRadio: number): void {
    const id = this.otId();
    this.mockDb.ordenesTrabajo.update(list =>
      list.map(o => (o.id === id ? { ...o, radioBusquedaKm: nuevoRadio } : o))
    );
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
}
