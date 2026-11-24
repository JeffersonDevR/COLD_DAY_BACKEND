import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Barra de marca del sistema (Stitch): identidad Cold Day · Ops, etiqueta de
 * pantalla y chip de contexto (modo o estado).
 *
 * Nace de la fila que solo tenía el Panel del cliente (`.cd-panel__barra`) y
 * pasa a ser el estándar de las pantallas de tabs: cada pantalla lleva la
 * marca, su etiqueta y un chip con el modo activo.
 */
@Component({
  selector: 'cd-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cd-marca" [attr.data-testid]="testId() ?? null">
      <div class="cd-marca__identidad">
        <span class="cd-marca__logo" aria-hidden="true">
          <span class="cd-marca__copo"></span>
        </span>
        <div>
          <p class="cd-marca__nombre">Cold Day · Ops</p>
          <p class="cd-marca__pantalla">{{ pantalla() }}</p>
        </div>
      </div>
      @if (chip()) {
        <span
          class="cd-chip cd-chip--activo"
          [attr.data-testid]="chipTestId() ?? null"
        >{{ chip() }}</span>
      }
    </div>
  `,
})
export class MarcaBarraComponent {
  /** Etiqueta de la pantalla dentro del sistema (p. ej. "Radar"). */
  readonly pantalla = input.required<string>();
  /** Chip de contexto (modo o estado); vacío lo oculta. */
  readonly chip = input('');
  readonly chipTestId = input<string | null>(null);
  readonly testId = input<string | null>(null);
}
