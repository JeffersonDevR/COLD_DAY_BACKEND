import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Button],
  template: `
    <p-dialog
      [visible]="isOpen()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [style]="{ width: '28rem', maxWidth: '95vw' }"
      [header]="title()"
      (onHide)="canceled.emit()"
    >
      <div class="flex items-start gap-3">
        <i
          class="text-2xl mt-0.5"
          [class]="isDanger() ? 'pi pi-exclamation-triangle text-rose-600' : 'pi pi-question-circle text-sky-600'"
        ></i>
        <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed m-0">{{ message() }}</p>
      </div>

      <ng-template #footer>
        <p-button
          [label]="cancelLabel()"
          severity="secondary"
          [text]="true"
          (onClick)="canceled.emit()"
        />
        <p-button
          [label]="confirmLabel()"
          [severity]="isDanger() ? 'danger' : undefined"
          (onClick)="confirmed.emit()"
        />
      </ng-template>
    </p-dialog>
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
