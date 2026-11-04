import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
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
      <ion-tab-bar class="cd-tab-bar" slot="bottom">
        @for (tab of tabs; track tab.id) {
          <ion-tab-button [tab]="tab.id" [attr.data-testid]="'tab-' + tab.id">
            <ion-icon
              [name]="activeTab() === tab.id ? tab.iconActive : tab.icon"
              aria-hidden="true"
            ></ion-icon>
            <ion-label>{{ tab.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class ModoTabsPage {
  private readonly data = inject(ActivatedRoute).snapshot.data;
  private readonly router = inject(Router);

  protected readonly modo = this.data['modo'] as ModoApp;
  protected readonly tabs: readonly ModoTab[] = MODOS[this.modo].tabs;

  /** Id of the active tab, derived from the URL (`/<modo>/<tab>`). */
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => this.tabFromUrl(event.urlAfterRedirects)),
      startWith(this.tabFromUrl(this.router.url)),
    ),
    { initialValue: this.tabFromUrl(this.router.url) },
  );

  private tabFromUrl(url: string): string | null {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    return segments.length >= 2 ? segments[1] : null;
  }
}
