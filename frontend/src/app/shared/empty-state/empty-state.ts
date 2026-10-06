import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './empty-state.html',
})
export class EmptyState {
  /** Clase PrimeIcons, p. ej. "pi pi-inbox". */
  readonly icon = input<string>('pi pi-inbox');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input<string>('');
  /** Clase PrimeIcons, p. ej. "pi pi-plus". */
  readonly actionIcon = input<string>('');
  readonly actionClicked = output<void>();
}
