import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Toast],
  templateUrl: './toast-host.html',
})
export class ToastHost {}
