import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Button],
  templateUrl: './confirm-dialog.html',
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
