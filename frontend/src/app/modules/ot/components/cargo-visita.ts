import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { Point, TarifaEstimadaResponse } from '../../../core/shared/domain/models/common.models';

/**
 * Aviso del cargo "Visita y diagnóstico" que se notifica al cliente cuando el
 * técnico acepta la orden. La tarifa la calcula el backend por distancia
 * (POST /api/ot/tarifa/estimar): base metropolitana + brackets marginales,
 * con estado fuera de rango explícito. Reemplaza el cargo fijo 40.000 + 20.000.
 */
@Component({
  selector: 'app-cargo-visita',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-3xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-5 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
          <i class="pi pi-wallet"></i>
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-bold text-sky-900 dark:text-sky-100">Visita y diagnóstico</h3>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-200/70 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
              Cargo notificado
            </span>
          </div>
          <p class="text-xs text-sky-800/80 dark:text-sky-200/80 leading-relaxed mt-0.5">
            El técnico aceptó tu solicitud. Este es el cargo por la visita y el diagnóstico en sitio.
          </p>
        </div>
      </div>

      <div aria-live="polite">
        @if (cargando()) {
          <div class="flex items-center gap-2 text-xs text-sky-800/80 dark:text-sky-200/80 py-2">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Calculando la tarifa por distancia...</span>
          </div>
        } @else if (error()) {
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
            No se pudo calcular la tarifa por distancia en este momento. Se confirmará al finalizar el servicio.
          </div>
        } @else if (estimacion(); as est) {
          @if (est.fueraDeRango) {
            <div class="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p class="font-bold">Fuera del radio de cobertura</p>
              <p class="leading-relaxed">
                Tu ubicación está a {{ est.distanciaKm.toLocaleString('es-CO') }} km del centro de servicio,
                por fuera del radio máximo. La tarifa de visita se confirmará con el técnico asignado.
              </p>
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5">
                <span class="block text-slate-500 dark:text-slate-400">Distancia</span>
                <span class="font-bold text-slate-900 dark:text-slate-100">{{ est.distanciaKm.toLocaleString('es-CO') }} km</span>
              </div>
              <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5">
                <span class="block text-slate-500 dark:text-slate-400">Origen del cálculo</span>
                <span class="font-bold text-slate-900 dark:text-slate-100">{{ etiquetaFuente(est.tarifaFuente) }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-sky-200/70 dark:border-sky-900 text-sm">
              <span class="font-semibold text-sky-900 dark:text-sky-100">Total visita + diagnóstico</span>
              <span class="font-black text-sky-900 dark:text-sky-100">
                {{ est.tarifa !== null ? formato(est.tarifa) + ' COP' : 'Por confirmar' }}
              </span>
            </div>
          }
        } @else {
          <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
            La tarifa de visita se calcula por distancia y se confirmará al registrar la ubicación del servicio.
          </div>
        }
      </div>

      <p class="text-[11px] text-sky-800/70 dark:text-sky-200/70 leading-relaxed">
        {{ nota() }}
      </p>
    </div>
  `,
})
export class CargoVisitaDiagnostico {
  private readonly otApi = inject(OtApi);

  readonly nota = input<string>(
    'Se cobra al confirmarse la asignación del técnico y no incluye la reparación. Si rechazas el presupuesto de reparación, este cargo por la visita y el diagnóstico ya fue prestado.'
  );

  /** Punto de servicio del cliente; con él se consulta la tarifa por distancia. */
  readonly punto = input<Point | undefined>(undefined);

  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  constructor() {
    effect(() => {
      const destino = this.punto();
      if (!destino) {
        this.estimacion.set(null);
        this.error.set(false);
        this.cargando.set(false);
        return;
      }
      this.cargando.set(true);
      this.error.set(false);
      this.otApi.estimarTarifa(destino).subscribe({
        next: (estimacion) => {
          this.estimacion.set(estimacion);
          this.cargando.set(false);
        },
        error: () => {
          this.estimacion.set(null);
          this.error.set(true);
          this.cargando.set(false);
        },
      });
    });
  }

  etiquetaFuente(fuente: TarifaEstimadaResponse['tarifaFuente']): string {
    return fuente === 'ROAD' ? 'Ruta por carretera' : 'Distancia lineal';
  }

  formato(valor: number): string {
    return '$ ' + valor.toLocaleString('es-CO');
  }
}
