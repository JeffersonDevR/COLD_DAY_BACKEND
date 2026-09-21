import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
          <div class="flex items-start gap-4">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              [class.bg-rose-100]="isDanger()"
              [class.text-rose-600]="isDanger()"
              [class.dark:bg-rose-950/60]="isDanger()"
              [class.bg-sky-100]="!isDanger()"
              [class.text-sky-600]="!isDanger()"
              [class.dark:bg-sky-950/60]="!isDanger()"
            >
              <mat-icon>{{ isDanger() ? 'warning' : 'help_outline' }}</mat-icon>
            </div>
            <div class="flex-1">
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ title() }}</h3>
              <p class="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{{ message() }}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              (click)="canceled.emit()"
              class="px-4 py-2 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              (click)="confirmed.emit()"
              class="px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-sm transition-colors"
              [class.bg-rose-600]="isDanger()"
              [class.hover:bg-rose-700]="isDanger()"
              [class.bg-sky-600]="!isDanger()"
              [class.hover:bg-sky-700]="!isDanger()"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialog {
  readonly isOpen = input<boolean>(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');
  readonly isDanger = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly canceled = output<void>();
}
