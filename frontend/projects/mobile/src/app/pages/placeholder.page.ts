import {Component, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {IonContent, IonHeader, IonTitle, IonToolbar} from '@ionic/angular';

/**
 * Shared placeholder for the three mobile modes. Each `/tabs/*` route supplies
 * its `title` and `description` through route data, so P0 needs no duplicated
 * screens; P2 replaces these routes with the real inventory pages.
 */
@Component({
  selector: 'app-mobile-placeholder',
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="cd-card">
        <p class="cd-eyebrow">{{ title }}</p>
        <h1 class="cd-headline">Próximamente</h1>
        <p class="cd-muted">{{ description }}</p>
      </section>
    </ion-content>
  `,
})
export class PlaceholderPage {
  private readonly data = inject(ActivatedRoute).snapshot.data;

  protected readonly title = this.data['title'] as string;
  protected readonly description = this.data['description'] as string;
}
