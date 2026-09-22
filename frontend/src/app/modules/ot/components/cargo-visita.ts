import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { environment } from '../../../../environments/environment';

/**
 * Aviso del cargo fijo "Visita + diagnóstico" que se notifica al cliente cuando
 * el técnico acepta la orden. Diagnóstico estándar + transporte.
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

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5">
          <span class="block text-slate-500 dark:text-slate-400">Diagnóstico estándar</span>
          <span class="font-bold text-slate-900 dark:text-slate-100">{{ formato(cargoDiagnostico) }}</span>
        </div>
        <div class="rounded-2xl bg-white/70 dark:bg-slate-900/60 px-3 py-2.5">
          <span class="block text-slate-500 dark:text-slate-400">Transporte</span>
          <span class="font-bold text-slate-900 dark:text-slate-100">{{ formato(cargoTransporte) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-sky-200/70 dark:border-sky-900 text-sm">
        <span class="font-semibold text-sky-900 dark:text-sky-100">Total visita + diagnóstico</span>
        <span class="font-black text-sky-900 dark:text-sky-100">{{ formato(total) }} COP</span>
      </div>

      <p class="text-[11px] text-sky-800/70 dark:text-sky-200/70 leading-relaxed">
        {{ nota() }}
      </p>
    </div>
  `,
})
export class CargoVisitaDiagnostico {
  readonly nota = input<string>(
    'Se cobra al confirmarse la asignación del técnico y no incluye la reparación. Si rechazas el presupuesto de reparación, este cargo por la visita y el diagnóstico ya fue prestado.'
  );

  readonly cargoDiagnostico = environment.diagnosticoPrecio;
  readonly cargoTransporte = environment.transportePrecio;
  readonly total = this.cargoDiagnostico + this.cargoTransporte;

  formato(valor: number): string {
    return '$ ' + valor.toLocaleString('es-CO');
  }
}
