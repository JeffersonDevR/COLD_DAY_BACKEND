import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center p-6 gap-3">
      <div class="relative w-10 h-10">
        <div class="absolute inset-0 rounded-full border-3 border-sky-200 dark:border-sky-950"></div>
        <div class="absolute inset-0 rounded-full border-3 border-sky-500 border-t-transparent animate-spin"></div>
      </div>
      @if (label()) {
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ label() }}</span>
      }
    </div>
  `
})
export class Loader {
  readonly label = input<string>('Cargando datos...');
}
