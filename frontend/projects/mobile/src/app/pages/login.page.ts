import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {IonButton, IonContent} from '@ionic/angular';

/** P0 stub: the real A1 login screen is P2.1 work. */
@Component({
  selector: 'app-mobile-login',
  imports: [IonButton, IonContent, RouterLink],
  template: `
    <ion-content class="ion-padding">
      <section class="cd-card">
        <p class="cd-eyebrow">Cold Day</p>
        <h1 class="cd-headline">Login próximamente</h1>
        <p class="cd-muted">
          La app móvil está en construcción. Mientras tanto, entra desde la web para gestionar tus servicios.
        </p>
        <ion-button expand="block" routerLink="/tabs">Ver el shell de prueba</ion-button>
      </section>
    </ion-content>
  `,
})
export class LoginPage {}
