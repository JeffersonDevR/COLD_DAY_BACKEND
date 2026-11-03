import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '@core/service/auth.service';
import { ModoApp, ORDEN_MODOS } from '../../modo/modo';
import { ModoService } from '../../modo/modo.service';

const ETIQUETA_MODO: Record<ModoApp, string> = {
  CLIENTE: 'Cliente',
  TECNICO: 'Técnico',
  PROVEEDOR: 'Proveedor',
};

/**
 * A3 — Mi cuenta (Stitch). Concentra la identidad de la sesión, el selector de
 * modo (B15) y el cierre de sesión.
 *
 * El selector muestra SIEMPRE los tres modos: los que la cuenta no tiene quedan
 * deshabilitados con la explicación, en vez de esconderse sin contexto.
 */
@Component({
  selector: 'app-mobile-cuenta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Mi cuenta</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="cd-card">
        <p class="cd-eyebrow">Cuenta</p>
        <h1 class="cd-headline" data-testid="cuenta-nombre">{{ nombre() }}</h1>
        <p class="cd-muted" data-testid="cuenta-correo">{{ correo() }}</p>
      </section>

      <section class="cd-card cd-modos">
        <p class="cd-eyebrow">Modo de la app</p>
        <p class="cd-muted">
          Elegí con qué perfil querés usar Cold Day. Podés cambiarlo cuando quieras.
        </p>

        @for (modo of todos; track modo) {
          <button
            type="button"
            class="cd-modo"
            [class.cd-modo--activo]="esActual(modo)"
            [disabled]="!disponible(modo)"
            [attr.aria-pressed]="esActual(modo)"
            [attr.data-testid]="'modo-' + modo.toLowerCase()"
            (click)="elegir(modo)"
          >
            <span class="cd-modo__nombre">{{ etiqueta(modo) }}</span>
            @if (esActual(modo)) {
              <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon>
            }
            @if (!disponible(modo)) {
              <span class="cd-modo__nota">Tu cuenta no tiene este perfil</span>
            }
          </button>
        }
      </section>

      <ion-button
        expand="block"
        fill="outline"
        color="danger"
        data-testid="salir"
        (click)="salir()"
      >
        Cerrar sesión
      </ion-button>
    </ion-content>
  `,
})
export class CuentaPage {
  private readonly auth = inject(AuthService);
  private readonly modos = inject(ModoService);

  protected readonly todos = ORDEN_MODOS;
  protected readonly modoActual = this.modos.modoActual;
  protected readonly disponibles = this.modos.modosDisponibles;

  protected readonly usuario = this.auth.currentUser;

  protected readonly nombre = computed(() => {
    const usuario = this.usuario();
    return usuario?.nombre || usuario?.correo || 'Tu cuenta';
  });

  protected readonly correo = computed(() => this.usuario()?.correo ?? '');

  protected etiqueta(modo: ModoApp): string {
    return ETIQUETA_MODO[modo];
  }

  protected esActual(modo: ModoApp): boolean {
    return this.modoActual() === modo;
  }

  protected disponible(modo: ModoApp): boolean {
    return this.disponibles().includes(modo);
  }

  protected elegir(modo: ModoApp): void {
    this.modos.cambiarModo(modo);
  }

  protected salir(): void {
    this.auth.logout();
  }
}
