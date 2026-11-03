import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

/**
 * Pantalla compartida de los leaves que todavía no tienen negocio implementado
 * (P2 los reemplaza). El título y la descripción llegan por `data` de la ruta.
 */
@Component({
  selector: 'app-mobile-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
