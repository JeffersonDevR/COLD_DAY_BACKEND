import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <div class="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <div class="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
        <i [class]="icon() + ' text-3xl'"></i>
      </div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ title() }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5 leading-relaxed">{{ description() }}</p>
      @if (actionLabel()) {
        <p-button
          [label]="actionLabel()"
          [icon]="actionIcon() || undefined"
          (onClick)="actionClicked.emit()"
        />
      }
    </div>
  `
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
