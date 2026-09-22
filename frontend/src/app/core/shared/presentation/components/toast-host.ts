import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Toast],
  template: `
    <!-- Notificaciones flotantes gestionadas por ToastService (PrimeNG). -->
    <p-toast position="bottom-right" [breakpoints]="{ '640px': { width: '90vw', right: '5vw' } }" />
  `
})
export class ToastHost {}
