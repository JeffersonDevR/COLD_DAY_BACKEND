import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs} from '@ionic/angular';
import {MOBILE_TABS} from '../mobile-mode';

/**
 * P0 tab shell. Ionic's `ion-tabs` renders its own nested router outlet, so the
 * three mode placeholders below it are routed children of `/tabs`.
 */
@Component({
  selector: 'app-mobile-tabs',
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, RouterLink],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @for (tab of tabs; track tab.rol) {
          <ion-tab-button [tab]="tab.rol.toLowerCase()" [routerLink]="tab.path">
            <ion-icon [name]="tab.icon"></ion-icon>
            <ion-label>{{ tab.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  protected readonly tabs = MOBILE_TABS;
}
