import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/** Estado vacío con mensaje honesto y, opcionalmente, una acción proyectada. */
@Component({
  selector: 'cd-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <section class="cd-vacio" [attr.data-testid]="testId()">
      @if (icono()) {
        <ion-icon [name]="icono()!" aria-hidden="true"></ion-icon>
      }
      <h2 class="cd-vacio__titulo">{{ titulo() }}</h2>
      <p class="cd-vacio__texto">{{ texto() }}</p>
      <ng-content></ng-content>
    </section>
  `,
})
export class EmptyStateComponent {
  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
  readonly icono = input<string | null>(null);
  readonly testId = input<string | null>(null);
}
