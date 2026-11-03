import {Component} from '@angular/core';
import {IonApp, IonRouterOutlet} from '@ionic/angular';

/**
 * Root shell of the mobile app: Ionic providers the outlet consumed by the
 * router. Business screens land inside this outlet from P1 onward.
 */
@Component({
  selector: 'app-mobile-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class MobileApp {}
