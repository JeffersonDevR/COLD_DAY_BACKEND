import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular';
import { MODOS, ModoApp, ModoTab } from '../../modo/modo';

/**
 * Shell de tabs de un modo.
 *
 * `ion-tabs` sin `ion-tab` hijos crea su propio `ion-router-outlet`, así que las
 * rutas hijas del modo se apilan dentro. El id de cada tab es el segmento de
 * ruta (`panel`, `equipos`, ...) e Ionic navega a `<prefijo>/<id>`.
 */
@Component({
  selector: 'app-mobile-modo-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @for (tab of tabs; track tab.id) {
          <ion-tab-button [tab]="tab.id" [attr.data-testid]="'tab-' + tab.id">
            <ion-icon [name]="tab.icon" aria-hidden="true"></ion-icon>
            <ion-label>{{ tab.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class ModoTabsPage {
  private readonly data = inject(ActivatedRoute).snapshot.data;

  protected readonly modo = this.data['modo'] as ModoApp;
  protected readonly tabs: readonly ModoTab[] = MODOS[this.modo].tabs;
}
