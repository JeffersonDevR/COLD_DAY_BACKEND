import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressSpinner],
  templateUrl: './loader.html',
})
export class Loader {
  readonly label = input<string>('Cargando datos...');
}
