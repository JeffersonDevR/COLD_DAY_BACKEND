import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
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
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonToolbar],
  template: `
    <ion-header class="cd-header">
      <ion-toolbar>
        <div class="cd-auth__bar cd-auth__bar--nav">
          <span aria-hidden="true"></span>
          <h1 class="cd-auth__bar-titulo">Mi cuenta</h1>
          <span class="cd-chip cd-chip--ok" data-testid="cuenta-verificado">Verificado</span>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <section class="cd-card cd-cuenta__identidad">
        <span class="cd-cuenta__avatar" aria-hidden="true">{{ inicial() }}</span>
        <div class="cd-cuenta__datos">
          <h2 class="cd-cuenta__nombre" data-testid="cuenta-nombre">{{ nombre() }}</h2>
          <p class="cd-cuenta__rol">Cuenta activa · {{ etiqueta(modoActivo()) }}</p>
          <p class="cd-muted" data-testid="cuenta-correo">{{ correo() }}</p>
        </div>
      </section>

      <section class="cd-card cd-cuenta__aviso">
        <ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon>
        <p>El mismo usuario puede actuar como cliente y como técnico; elegí con qué modo abrir la app.</p>
      </section>

      <section class="cd-card cd-modos">
        <p class="cd-eyebrow">Modo de la app</p>
        <p class="cd-muted">Elegí con qué perfil querés usar Cold Day. Podés cambiarlo cuando quieras.</p>

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
            <span class="cd-modo__icono" aria-hidden="true">
              <ion-icon [name]="icono(modo)"></ion-icon>
            </span>
            <span class="cd-modo__texto">
              <span class="cd-modo__nombre">{{ etiqueta(modo) }}</span>
              <span class="cd-modo__nota">{{ descripcion(modo) }}</span>
            </span>
            @if (esActual(modo)) {
              <span class="cd-modo__pill">En uso</span>
            } @else if (!disponible(modo)) {
              <span class="cd-modo__pill cd-modo__pill--off">No disponible</span>
            }
          </button>
        }
      </section>

      @if (faltantes().length > 0) {
        <section class="cd-card" data-testid="cuenta-agregar-perfil">
          <p class="cd-eyebrow">Agregar perfil</p>
          <p class="cd-muted">
            Tu cuenta todavía no tiene estos perfiles: {{ faltantesTexto() }}. El alta se completa
            desde la web, o desde la solicitud de servicio cuando es el perfil de cliente.
          </p>
        </section>
      }

      <ion-button
        expand="block"
        fill="outline"
        color="danger"
        data-testid="salir"
        (click)="salir()"
      >
        <ion-icon slot="start" name="log-out-outline" aria-hidden="true"></ion-icon>
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

  /** El modo activo siempre existe al entrar a esta pantalla; el fallback evita null. */
  protected readonly modoActivo = computed<ModoApp>(() => this.modoActual() ?? 'CLIENTE');

  protected readonly usuario = this.auth.currentUser;

  protected readonly nombre = computed(() => {
    const usuario = this.usuario();
    return usuario?.nombre || usuario?.correo || 'Tu cuenta';
  });

  protected readonly correo = computed(() => this.usuario()?.correo ?? '');

  protected readonly inicial = computed(() => {
    const nombre = this.usuario()?.nombre?.trim();
    return nombre ? nombre.charAt(0).toUpperCase() : '?';
  });

  protected readonly faltantes = computed(() =>
    this.todos.filter((modo) => !this.disponibles().includes(modo)),
  );

  protected readonly faltantesTexto = computed(() =>
    this.faltantes().map((modo) => this.etiqueta(modo)).join(' ni '),
  );

  protected icono(modo: ModoApp): string {
    switch (modo) {
      case 'CLIENTE':
        return 'home-outline';
      case 'TECNICO':
        return 'construct-outline';
      case 'PROVEEDOR':
        return 'cube-outline';
    }
  }

  protected descripcion(modo: ModoApp): string {
    switch (modo) {
      case 'CLIENTE':
        return 'Pedí reparaciones y seguí tus órdenes';
      case 'TECNICO':
        return 'Recibí ofertas y ejecutá servicios';
      case 'PROVEEDOR':
        return 'Vendé insumos a técnicos certificados';
    }
  }

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
