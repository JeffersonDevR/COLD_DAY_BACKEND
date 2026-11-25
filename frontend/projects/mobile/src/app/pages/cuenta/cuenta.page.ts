import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonHeader,
  IonIcon,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '@core/service/auth.service';
import { PushNotificacionesService } from '../../core/push';
import { ModoApp, ORDEN_MODOS } from '../../modo/modo';
import { ModoService } from '../../modo/modo.service';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { PageComponent } from '../../shared/ui/page/page';

const ETIQUETA_MODO: Record<ModoApp, string> = {
  CLIENTE: 'Cliente',
  TECNICO: 'Técnico',
  PROVEEDOR: 'Proveedor',
};

/**
 * A3 — Mi cuenta (Stitch). Concentra la identidad de la sesión, el selector de
 * modo (solo con más de un perfil habilitado), el pedido de perfiles (solo para
 * quien se registró como técnico) y el cierre de sesión.
 *
 * Regla del dueño (2026-11-23) + PRODUCT.md: solo quien se registró como
 * técnico puede adoptar/pedir un perfil desde la app; los demás perfiles los
 * activa el administrador por fuera. Un cliente puro no ve modos ni solicitudes.
 *
 * Organización: el mismo `<cd-page>` de las otras pantallas principales. El
 * título vive en la cabecera y las secciones siguen el orden
 * identidad → modo → solicitud → cerrar sesión. No hay CTA de pie propio: las
 * acciones siguen junto a su sección, sin inventar un footer nuevo.
 */
@Component({
  selector: 'app-mobile-cuenta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonHeader,
    IonIcon,
    IonToolbar,
    PageComponent,
    MarcaBarraComponent,
  ],
  template: `
    <cd-page>
      <ion-header class="cd-header" cdHeader>
        <ion-toolbar>
          <cd-marca pantalla="Mi cuenta" [chip]="etiqueta(modoActivo())" chipTestId="cuenta-verificado" />
        </ion-toolbar>
      </ion-header>

      <section class="cd-card cd-cuenta__identidad">
        <span class="cd-cuenta__avatar" aria-hidden="true">{{ inicial() }}</span>
        <div class="cd-cuenta__datos">
          <h2 class="cd-cuenta__nombre" data-testid="cuenta-nombre">{{ nombre() }}</h2>
          <p class="cd-cuenta__rol">Cuenta activa · {{ etiqueta(modoActivo()) }}</p>
          <p class="cd-muted" data-testid="cuenta-correo">{{ correo() }}</p>
        </div>
      </section>

      @if (modoActivo() === 'TECNICO') {
        <section class="cd-card">
          <button
            type="button"
            class="cd-modo"
            data-testid="cuenta-perfil-tecnico"
            (click)="irAlPerfilTecnico()"
          >
            <span class="cd-modo__icono" aria-hidden="true">
              <ion-icon aria-hidden="true" [name]="icono('TECNICO')"></ion-icon>
            </span>
            <span class="cd-modo__texto">
              <span class="cd-modo__nombre">Mi perfil técnico</span>
              <span class="cd-modo__nota">Especialidades, matrícula y documentos</span>
            </span>
          </button>
        </section>
      }

      <!-- El selector de modo solo existe cuando hay más de un perfil real que
           elegir (petición del dueño 2026-11-23): un cliente puro no ve "modos". -->
      @if (disponibles().length > 1) {
        <section class="cd-card cd-modos">
          <p class="cd-eyebrow">Modo de la app</p>
          <p class="cd-muted">Elige con qué perfil quieres usar Cold Day. Puedes cambiarlo cuando quieras.</p>
          <p class="cd-muted cd-modos__conteo" data-testid="cuenta-perfiles-habilitados">
            {{ disponibles().length }} de {{ todos.length }} perfiles habilitados
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
              <span class="cd-modo__icono" aria-hidden="true">
                <ion-icon aria-hidden="true" [name]="icono(modo)"></ion-icon>
              </span>
              <span class="cd-modo__texto">
                <span class="cd-modo__nombre">{{ etiqueta(modo) }}</span>
                <span class="cd-modo__nota">{{ descripcion(modo) }}</span>
              </span>
              @if (esActual(modo)) {
                <span class="cd-modo__pill">En uso</span>
              } @else if (!disponible(modo)) {
                <span class="cd-modo__pill cd-modo__pill--off" [attr.data-testid]="'modo-bloqueado-' + modo.toLowerCase()">
                  Pídelo al admin
                </span>
              }
            </button>
          }
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
    </cd-page>
  `,
})
export class CuentaPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushNotificacionesService);
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
        return 'Pide reparaciones y sigue tus órdenes';
      case 'TECNICO':
        return 'Recibe ofertas y ejecuta servicios';
      case 'PROVEEDOR':
        return 'Vende insumos a técnicos certificados';
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

  protected irAlPerfilTecnico(): void {
    void this.router.navigate(['/tecnico/perfil']);
  }

  protected salir(): void {
    // Da de baja el token push antes de perder el JWT; sin token sale directo.
    if (this.push.tieneToken()) {
      void this.push.desactivar().finally(() => this.auth.logout());
      return;
    }
    this.auth.logout();
  }
}
