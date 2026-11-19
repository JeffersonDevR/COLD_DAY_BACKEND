import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonContent } from '@ionic/angular';

/**
 * Contenedor único de página: cabecera opcional, héroe con título/subtítulo
 * (sin eyebrow sobre el título de pantalla, DESIGN §3 UI-T5), contenido con el
 * gutter de 16 px y pie opcional.
 *
 * El host es `display: contents` (ver `.cd-page` en componentes.css): así
 * `ion-header`/`ion-content`/`ion-footer` siguen siendo hijos flex de `.ion-page`
 * y conservan `order:-1` / `order:1` sin envoltorio extra.
 *
 * Slots: `[cdHeader]`, `[cdHeroAcciones]`, `[cdFooter]` y contenido por defecto.
 * Las pantallas con título en la cabecera proyectan `[cdHeader]` y omiten
 * `titulo`; las que tienen héroe propio (saludo) usan `titulo`/`subtitulo`.
 */
@Component({
  selector: 'cd-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cd-page' },
  imports: [IonContent],
  template: `
    <ng-content select="[cdHeader]"></ng-content>
    <ion-content
      [class]="contenidoClase() ? 'ion-padding ' + contenidoClase() : 'ion-padding'"
    >
      @if (titulo()) {
        <div class="cd-hero">
          <h1 class="cd-headline" [attr.data-testid]="tituloTestId()">{{ titulo() }}</h1>
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
  /** Etiqueta de prueba del `<h1>` del héroe (p. ej. `panel-saludo`). */
  readonly tituloTestId = input<string | null>(null);
  /** Clase adicional para `ion-content` (p. ej. el respiro del footer fijo). */
  readonly contenidoClase = input<string>('');
}
