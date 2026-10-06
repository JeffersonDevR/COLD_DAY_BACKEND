import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EstadoOt, HistorialOtItem } from '../../core/models/common.models';

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
  templateUrl: './ot-timeline.html',
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
