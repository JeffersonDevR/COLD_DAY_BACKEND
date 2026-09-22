import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastTipo = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

/**
 * Fachada sobre el MessageService de PrimeNG para mantener la API que ya
 * consumían las páginas (success/error/info/warning) y renderizar con <p-toast>.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messages = inject(MessageService);
  private toastSeq = 0;

  show(tipo: ToastTipo, titulo: string, mensaje?: string, duracionMs = 4000): void {
    const severity = {
      SUCCESS: 'success',
      ERROR: 'error',
      INFO: 'info',
      WARNING: 'warn',
    }[tipo] as 'success' | 'error' | 'info' | 'warn';

    this.messages.add({
      id: `toast-${Date.now()}-${this.toastSeq++}`,
      severity,
      summary: titulo,
      detail: mensaje,
      life: duracionMs,
    });
  }

  success(titulo: string, mensaje?: string): void {
    this.show('SUCCESS', titulo, mensaje);
  }

  error(titulo: string, mensaje?: string): void {
    this.show('ERROR', titulo, mensaje, 5000);
  }

  info(titulo: string, mensaje?: string): void {
    this.show('INFO', titulo, mensaje);
  }

  warning(titulo: string, mensaje?: string): void {
    this.show('WARNING', titulo, mensaje, 4500);
  }

  clear(): void {
    this.messages.clear();
  }
}
