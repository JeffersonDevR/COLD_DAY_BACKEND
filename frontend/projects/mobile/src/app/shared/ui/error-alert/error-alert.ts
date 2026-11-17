import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';

/** Error de carga con causa legible y botón de reintento. */
@Component({
  selector: 'cd-error-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon],
  template: `
    <section class="cd-alerta cd-alerta--error" role="alert" [attr.data-testid]="testId()">
      <h2 class="cd-alerta__titulo">{{ titulo() }}</h2>
      <p class="cd-alerta__texto">{{ texto() }}</p>
      <ion-button class="cd-cta" [attr.data-testid]="accionTestId()" (click)="reintentar.emit()">
        <ion-icon slot="start" name="refresh-outline" aria-hidden="true"></ion-icon>
        Reintentar
      </ion-button>
    </section>
  `,
})
export class ErrorAlertComponent {
  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
  readonly testId = input<string | null>(null);
  readonly accionTestId = input<string | null>(null);
  readonly reintentar = output<void>();
}
