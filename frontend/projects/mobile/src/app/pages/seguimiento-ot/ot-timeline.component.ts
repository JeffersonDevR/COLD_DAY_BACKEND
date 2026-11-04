import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { EstadoOt, HistorialOtItem } from '@core/models/common.models';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { TimelinePaso, calcularPasosTimeline } from '@core/service/ot-timeline';

/** Web icon (PrimeIcons key) → ionicons name. */
const ICONO_PASO: Readonly<Record<string, string>> = {
  'file-plus': 'document-text-outline',
  compass: 'compass-outline',
  user: 'person-outline',
  truck: 'car-outline',
  wrench: 'build-outline',
  hammer: 'hammer-outline',
  verified: 'checkmark-circle-outline',
};

/**
 * A6 — Timeline del ciclo operativo.
 *
 * Misma regla que la web (`@core/service/ot-timeline`): los pasos, su orden y
 * su estado de completado/actual salen de la función compartida. Este
 * componente solo les pone piel móvil (ionicons, cinta deslizable).
 */
@Component({
  selector: 'app-ot-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IonIcon],
  template: `
    <section class="cd-timeline" aria-label="Estado del servicio">
      <div class="cd-timeline__encabezado">
        <div>
          <h2 class="cd-timeline__titulo">Ciclo del servicio</h2>
          <p class="cd-timeline__nota">Dónde está tu orden, paso a paso.</p>
        </div>
        <span
          class="cd-chip cd-chip--{{ tono() }}"
          data-testid="timeline-estado"
        >{{ etiquetaEstado() }}</span>
      </div>

      <ol class="cd-timeline__pasos" data-testid="timeline-pasos">
        @for (paso of steps(); track paso.estado) {
          <li
            class="cd-timeline__paso"
            [class.is-current]="paso.isCurrent"
            [class.is-completed]="paso.isCompleted"
            [attr.data-testid]="'timeline-paso-' + paso.estado"
          >
            <span class="cd-timeline__nodo" aria-hidden="true">
              <ion-icon [name]="icono(paso)"></ion-icon>
            </span>
            <span class="cd-timeline__etiqueta">{{ paso.label }}</span>
          </li>
        }
      </ol>

      @if (historial().length > 0) {
        <details class="cd-timeline__historial" data-testid="timeline-historial">
          <summary class="cd-timeline__historial-toggle">
            Historial de estados ({{ historial().length }})
          </summary>
          <ul class="cd-timeline__historial-lista">
            @for (item of historial(); track item.fecha) {
              <li class="cd-timeline__historial-item">
                <span class="cd-timeline__actor">{{ item.actor || 'SISTEMA' }}</span>
                <div class="cd-timeline__historial-cuerpo">
                  <div class="cd-timeline__historial-fila">
                    <strong>{{ item.estado }}</strong>
                    <span class="cd-timeline__historial-fecha">{{ item.fecha | date: 'medium' }}</span>
                  </div>
                  @if (item.motivo) {
                    <p class="cd-timeline__historial-motivo">{{ item.motivo }}</p>
                  }
                </div>
              </li>
            }
          </ul>
        </details>
      }
    </section>
  `,
})
export class OtTimelineComponent {
  readonly estadoActual = input.required<EstadoOt>();
  readonly historial = input<HistorialOtItem[]>([]);

  readonly steps = computed<TimelinePaso[]>(() => calcularPasosTimeline(this.estadoActual()));
  readonly etiquetaEstado = computed(() => ETIQUETA_ESTADO_OT[this.estadoActual()]);
  readonly tono = computed(() => tonoEstadoOt(this.estadoActual()));

  protected icono(paso: TimelinePaso): string {
    if (paso.isCompleted && !paso.isCurrent) {
      return 'checkmark-outline';
    }
    return ICONO_PASO[paso.icon] ?? 'ellipse-outline';
  }
}
