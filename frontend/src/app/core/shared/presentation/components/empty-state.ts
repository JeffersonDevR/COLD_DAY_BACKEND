import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <div class="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
        <mat-icon class="text-3xl">{{ icon() }}</mat-icon>
      </div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ title() }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5 leading-relaxed">{{ description() }}</p>
      @if (actionLabel()) {
        <button
          type="button"
          (click)="actionClicked.emit()"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-colors"
        >
          @if (actionIcon()) {
            <mat-icon class="text-base">{{ actionIcon() }}</mat-icon>
          }
          {{ actionLabel() }}
        </button>
      }
    </div>
  `
})
export class EmptyState {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input<string>('');
  readonly actionIcon = input<string>('');
  readonly actionClicked = output<void>();
}
