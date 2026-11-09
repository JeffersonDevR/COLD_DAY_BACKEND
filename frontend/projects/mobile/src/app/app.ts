import { Component, inject } from '@angular/core';
import { IonApp, IonIcon, IonRouterOutlet } from '@ionic/angular';
import { NetworkStatusService } from './core/network';

/**
 * Root shell of the mobile app: Ionic providers the outlet consumed by the
 * router, plus a global offline banner. The banner informs; it never blocks the
 * user's action (the backend remains the source of truth).
 */
@Component({
  selector: 'app-mobile-root',
  imports: [IonApp, IonIcon, IonRouterOutlet],
  template: `
    <ion-app>
      @if (!red.enLinea()) {
        <div class="cd-offline" role="status" data-testid="app-offline">
          <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
          <span>Sin conexión. Las acciones pueden fallar hasta que vuelva la red.</span>
        </div>
      }
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class MobileApp {
  protected readonly red = inject(NetworkStatusService);
}
