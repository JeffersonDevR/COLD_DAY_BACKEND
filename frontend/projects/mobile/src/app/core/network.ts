import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Estado de conectividad de la app.
 *
 * En nativo usa el plugin de Capacitor (Wi-Fi/datos, no `navigator.onLine`); en
 * web cae a los eventos del navegador. La UI lo usa para avisar que las acciones
 * pueden fallar, no para bloquearlas: el backend sigue siendo la fuente de verdad.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  readonly enLinea = signal(true);

  constructor() {
    void Network.getStatus()
      .then((estado) => this.enLinea.set(estado.connected))
      .catch(() => this.enLinea.set(true));

    void Network.addListener('networkStatusChange', (estado) => {
      this.enLinea.set(estado.connected);
    });
  }
}
