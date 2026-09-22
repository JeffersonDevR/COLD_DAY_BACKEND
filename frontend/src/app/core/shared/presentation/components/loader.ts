import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressSpinner],
  template: `
    <div class="flex flex-col items-center justify-center p-6 gap-3">
      <p-progress-spinner [style]="{ width: '42px', height: '42px' }" strokeWidth="4" />
      @if (label()) {
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ label() }}</span>
      }
    </div>
  `
})
export class Loader {
  readonly label = input<string>('Cargando datos...');
}
