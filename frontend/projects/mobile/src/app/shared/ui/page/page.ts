import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonContent } from '@ionic/angular';

/**
 * Contenedor único de página: cabecera opcional, héroe con título/subtítulo
 * (sin eyebrow, DESIGN §3 UI-T5), contenido con el gutter de 16 px y pie fijo.
 * Las pantallas con cabecera propia proyectan [cdHeader] y omiten título.
 */
@Component({
  selector: 'cd-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
  template: `
    <ng-content select="[cdHeader]"></ng-content>
    <ion-content class="ion-padding">
      @if (titulo()) {
        <div class="cd-hero">
          <h1 class="cd-headline">{{ titulo() }}</h1>
          @if (subtitulo()) {
            <p class="cd-hero__nota">{{ subtitulo() }}</p>
          }
          <ng-content select="[cdHeroAcciones]"></ng-content>
        </div>
      }
      <ng-content></ng-content>
    </ion-content>
    <ng-content select="[cdFooter]"></ng-content>
  `,
})
export class PageComponent {
  readonly titulo = input<string | null>(null);
  readonly subtitulo = input<string | null>(null);
}
