import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import type { Prioridad } from '@core/models/common.models';
import { PriorityChipComponent } from '../priority-chip/priority-chip.component';

/**
 * La orden activa de un panel: estado en grande y un solo botón. Solo pinta lo
 * que recibe; el panel decide textos y destino.
 */
@Component({
  selector: 'cd-orden-activa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, PriorityChipComponent],
  template: `
    <section class="cd-orden-activa" data-testid="orden-activa">
      <p class="cd-dato__grande" aria-live="polite">{{ estado() }}</p>
      <div class="cd-orden-activa__identidad">
        <h2 class="cd-orden-activa__categoria">{{ categoria() }}</h2>
        @if (codigo(); as valor) {
          <span class="cd-ot__codigo">{{ valor }}</span>
        }
        @if (prioridad(); as valor) {
          <app-priority-chip [prioridad]="valor" />
        }
      </div>
      @if (contexto().length > 0) {
        <p class="cd-orden-activa__contexto">{{ contexto().join(' · ') }}</p>
      }
      @if (direccion(); as valor) {
        <p class="cd-orden-activa__direccion">
          <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
          {{ valor }}
        </p>
      }
      <ion-button
        expand="block"
        class="cd-cta"
        data-testid="orden-activa-accion"
        (click)="accionar.emit()"
      >
        {{ accion() }}
      </ion-button>
    </section>
  `,
})
export class OrdenActivaComponent {
  readonly estado = input.required<string>();
  readonly categoria = input.required<string>();
  readonly accion = input.required<string>();
  readonly codigo = input<string>();
  readonly prioridad = input<Prioridad>();
  readonly contexto = input<readonly string[]>([]);
  readonly direccion = input<string>();
  readonly accionar = output<void>();
}
