import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EstadoOt, HistorialOtItem } from '../../../core/shared/domain/models/common.models';

interface TimelineStep {
  estado: EstadoOt;
  label: string;
  icon: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

@Component({
  selector: 'app-ot-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="w-full bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
      <div class="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Ciclo Operativo del Servicio</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Seguimiento de estados en tiempo real (Fase 1)</p>
        </div>
        <span
          class="px-2.5 py-1 text-xs font-semibold rounded-full"
          [class.bg-sky-100]="estadoActual() !== 'FINALIZADA' && estadoActual() !== 'CANCELADA' && estadoActual() !== 'DISPUTADA'"
          [class.text-sky-800]="estadoActual() !== 'FINALIZADA' && estadoActual() !== 'CANCELADA' && estadoActual() !== 'DISPUTADA'"
          [class.bg-emerald-100]="estadoActual() === 'FINALIZADA'"
          [class.text-emerald-800]="estadoActual() === 'FINALIZADA'"
          [class.bg-rose-100]="estadoActual() === 'CANCELADA' || estadoActual() === 'DISPUTADA'"
          [class.text-rose-800]="estadoActual() === 'CANCELADA' || estadoActual() === 'DISPUTADA'"
        >
          {{ estadoActual() }}
        </span>
      </div>

      <!-- Steps Stepper Horizontal -->
      <div class="relative flex items-center justify-between overflow-x-auto pb-4 pt-2">
        <div class="absolute left-6 right-6 top-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0"></div>

        @for (step of steps(); track step.estado; let idx = $index) {
          <div class="relative z-10 flex flex-col items-center min-w-[80px] text-center px-1">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2"
              [class.bg-sky-600]="step.isCurrent"
              [class.text-white]="step.isCurrent || step.isCompleted"
              [class.border-sky-600]="step.isCurrent"
              [class.ring-4]="step.isCurrent"
              [class.ring-sky-100]="step.isCurrent"
              [class.dark:ring-sky-950]="step.isCurrent"

              [class.bg-emerald-500]="step.isCompleted && !step.isCurrent"
              [class.border-emerald-500]="step.isCompleted && !step.isCurrent"

              [class.bg-slate-100]="!step.isCompleted && !step.isCurrent"
              [class.text-slate-400]="!step.isCompleted && !step.isCurrent"
              [class.border-slate-300]="!step.isCompleted && !step.isCurrent"
              [class.dark:bg-slate-800]="!step.isCompleted && !step.isCurrent"
              [class.dark:border-slate-700]="!step.isCompleted && !step.isCurrent"
            >
              <i
                style="font-size: 18px;"
                [class]="'pi ' + (step.isCompleted && !step.isCurrent ? 'pi-check' : 'pi-' + step.icon)"
              ></i>
            </div>
            <span
              class="text-xs mt-2 font-medium leading-tight max-w-[85px]"
              [class.text-sky-600]="step.isCurrent"
              [class.font-bold]="step.isCurrent"
              [class.dark:text-sky-400]="step.isCurrent"
              [class.text-slate-700]="step.isCompleted && !step.isCurrent"
              [class.dark:text-slate-300]="step.isCompleted && !step.isCurrent"
              [class.text-slate-400]="!step.isCompleted && !step.isCurrent"
            >
              {{ step.label }}
            </span>
          </div>
        }
      </div>

      <!-- Historial Detallado -->
      @if (historial() && historial()!.length > 0) {
        <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Trazabilidad de Auditoría</h4>
          <div class="space-y-3">
            @for (item of historial(); track item.fecha) {
              <div class="flex items-start gap-3 text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                <span class="px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  {{ item.actor }}
                </span>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 dark:text-slate-200">{{ item.estado }}</span>
                    <span class="text-slate-400 text-[11px]">{{ item.fecha | date:'medium' }}</span>
                  </div>
                  @if (item.motivo) {
                    <p class="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{{ item.motivo }}</p>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class OtTimeline {
  readonly estadoActual = input.required<EstadoOt>();
  readonly historial = input<HistorialOtItem[]>([]);

  private readonly standardOrder: EstadoOt[] = [
    'SOLICITADA',
    'BUSCANDO_TECNICO',
    'ASIGNADA',
    'EN_CAMINO',
    'EN_DIAGNOSTICO',
    'EN_REPARACION',
    'FINALIZADA'
  ];

  readonly steps = computed<TimelineStep[]>(() => {
    const current = this.estadoActual();
    const currentIndex = this.standardOrder.indexOf(current);

    return [
      {
        estado: 'SOLICITADA',
        label: 'Solicitada',
        icon: 'file-plus',
        isCompleted: currentIndex >= 0,
        isCurrent: current === 'SOLICITADA'
      },
      {
        estado: 'BUSCANDO_TECNICO',
        label: 'Buscando',
        icon: 'compass',
        isCompleted: currentIndex >= 1,
        isCurrent: current === 'BUSCANDO_TECNICO'
      },
      {
        estado: 'ASIGNADA',
        label: 'Asignada',
        icon: 'user',
        isCompleted: currentIndex >= 2,
        isCurrent: current === 'ASIGNADA'
      },
      {
        estado: 'EN_CAMINO',
        label: 'En Camino',
        icon: 'truck',
        isCompleted: currentIndex >= 3,
        isCurrent: current === 'EN_CAMINO'
      },
      {
        estado: 'EN_DIAGNOSTICO',
        label: 'Diagnóstico',
        icon: 'wrench',
        isCompleted: currentIndex >= 4,
        isCurrent: current === 'EN_DIAGNOSTICO'
      },
      {
        estado: 'EN_REPARACION',
        label: 'Reparación',
        icon: 'hammer',
        isCompleted: currentIndex >= 5,
        isCurrent: current === 'EN_REPARACION'
      },
      {
        estado: 'FINALIZADA',
        label: 'Finalizada',
        icon: 'verified',
        isCompleted: currentIndex === 6 || current === 'FINALIZADA',
        isCurrent: current === 'FINALIZADA'
      }
    ];
  });
}
