import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EstadoOt, HistorialOtItem } from '../../core/models/common.models';
import { TimelinePaso, calcularPasosTimeline } from '../../core/service/ot-timeline';

@Component({
  selector: 'app-ot-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './ot-timeline.html',
})
export class OtTimeline {
  readonly estadoActual = input.required<EstadoOt>();
  readonly historial = input<HistorialOtItem[]>([]);

  readonly steps = computed<TimelinePaso[]>(() => calcularPasosTimeline(this.estadoActual()));
}
