import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  tipo: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
  titulo: string;
  mensaje?: string;
  duracionMs?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private toastSeq = 0;

  show(tipo: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING', titulo: string, mensaje?: string, duracionMs = 4000): void {
    const id = `toast-${Date.now()}-${this.toastSeq++}`;
    const newToast: ToastMessage = { id, tipo, titulo, mensaje, duracionMs };

    this._toasts.update(current => [...current, newToast]);

    if (duracionMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duracionMs);
    }
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

  dismiss(id: string): void {
    this._toasts.update(current => current.filter(t => t.id !== id));
  }
}
