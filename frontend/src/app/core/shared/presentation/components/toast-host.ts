import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [id]="toast.id"
          class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-slide-in"
          [class.bg-emerald-50]="toast.tipo === 'SUCCESS'"
          [class.border-emerald-200]="toast.tipo === 'SUCCESS'"
          [class.text-emerald-900]="toast.tipo === 'SUCCESS'"
          [class.dark:bg-emerald-950/80]="toast.tipo === 'SUCCESS'"
          [class.dark:border-emerald-800]="toast.tipo === 'SUCCESS'"
          [class.dark:text-emerald-200]="toast.tipo === 'SUCCESS'"

          [class.bg-rose-50]="toast.tipo === 'ERROR'"
          [class.border-rose-200]="toast.tipo === 'ERROR'"
          [class.text-rose-900]="toast.tipo === 'ERROR'"
          [class.dark:bg-rose-950/80]="toast.tipo === 'ERROR'"
          [class.dark:border-rose-800]="toast.tipo === 'ERROR'"
          [class.dark:text-rose-200]="toast.tipo === 'ERROR'"

          [class.bg-amber-50]="toast.tipo === 'WARNING'"
          [class.border-amber-200]="toast.tipo === 'WARNING'"
          [class.text-amber-900]="toast.tipo === 'WARNING'"
          [class.dark:bg-amber-950/80]="toast.tipo === 'WARNING'"
          [class.dark:border-amber-800]="toast.tipo === 'WARNING'"
          [class.dark:text-amber-200]="toast.tipo === 'WARNING'"

          [class.bg-sky-50]="toast.tipo === 'INFO'"
          [class.border-sky-200]="toast.tipo === 'INFO'"
          [class.text-sky-900]="toast.tipo === 'INFO'"
          [class.dark:bg-sky-950/80]="toast.tipo === 'INFO'"
          [class.dark:border-sky-800]="toast.tipo === 'INFO'"
          [class.dark:text-sky-200]="toast.tipo === 'INFO'"
        >
          <div class="mt-0.5 shrink-0">
            @switch (toast.tipo) {
              @case ('SUCCESS') {
                <mat-icon class="text-emerald-600 dark:text-emerald-400 text-xl">check_circle</mat-icon>
              }
              @case ('ERROR') {
                <mat-icon class="text-rose-600 dark:text-rose-400 text-xl">error</mat-icon>
              }
              @case ('WARNING') {
                <mat-icon class="text-amber-600 dark:text-amber-400 text-xl">warning</mat-icon>
              }
              @case ('INFO') {
                <mat-icon class="text-sky-600 dark:text-sky-400 text-xl">info</mat-icon>
              }
            }
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold leading-tight">{{ toast.titulo }}</h4>
            @if (toast.mensaje) {
              <p class="text-xs mt-1 opacity-90 leading-relaxed">{{ toast.mensaje }}</p>
            }
          </div>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
            aria-label="Cerrar notificación"
          >
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>
      }
    </div>
  `
})
export class ToastHost {
  readonly toastService = inject(ToastService);
}
