import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Esqueleto de lista. Antes cada pantalla repetía el mismo par de
 * <div class="cd-esqueleto"> dentro de .cd-lista-cargando.
 */
@Component({
  selector: 'cd-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cd-lista-cargando" role="status" [attr.aria-label]="label()" [attr.data-testid]="testId()">
      @for (fila of filas(); track fila) {
        <div class="cd-esqueleto" aria-hidden="true"></div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  readonly label = input('Cargando…');
  readonly count = input(2);
  readonly testId = input<string | null>(null);

  filas(): number[] {
    return Array.from({ length: Math.max(1, this.count()) }, (_, i) => i);
  }
}
