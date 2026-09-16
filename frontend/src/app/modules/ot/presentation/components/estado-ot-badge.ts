import { Component, computed, input } from '@angular/core';
import { CLASE_ESTADO_OT, ETIQUETA_ESTADO_OT, EstadoOt } from '../../domain/models/estado-ot.model';

@Component({
  selector: 'app-estado-ot-badge',
  template: `
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"
      [class]="clase()"
    >
      {{ etiqueta() }}
    </span>
  `,
})
export class EstadoOtBadge {
  readonly estado = input.required<EstadoOt>();

  protected readonly etiqueta = computed(() => ETIQUETA_ESTADO_OT[this.estado()]);
  protected readonly clase = computed(() => CLASE_ESTADO_OT[this.estado()]);
}
