import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '@core/service/auth.service';

/**
 * Salida para cuentas sin modo móvil (admin y contable): el panel de gestión
 * sigue en la web. Se les explica el camino en vez de dejarlos en un 403.
 */
@Component({
  selector: 'app-mobile-solo-web',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Usá la web</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="cd-card">
        <p class="cd-eyebrow">Cuenta de gestión</p>
        <h1 class="cd-headline">Tu panel sigue en la web</h1>
        <p class="cd-muted">
          La app móvil es para clientes, técnicos y proveedores. Las cuentas de
          administración y contabilidad gestionan todo desde el panel web de Cold Day.
        </p>
        <ion-button expand="block" fill="outline" data-testid="salir" (click)="salir()">
          Cerrar sesión
        </ion-button>
      </section>
    </ion-content>
  `,
})
export class SoloWebPage {
  private readonly auth = inject(AuthService);

  protected salir(): void {
    this.auth.logout();
  }
}
