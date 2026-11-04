import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSpinner,
} from '@ionic/angular';
import { mensajeErrorAccion } from '@core/alertas/mensaje-error';
import { AuthService } from '@core/service/auth.service';
import { UsuariosApi } from '@core/service/usuarios-api';
import { MobileToastService } from '../../core/toast.service';
import { ModoService } from '../../modo/modo.service';

/** En el login un 401 son credenciales que no coinciden, no una sesión vencida. */
const MENSAJES_LOGIN: Record<number, string> = {
  401: 'Correo o contraseña incorrectos. Revisalos e intentá de nuevo.',
};

/**
 * A1 — Login móvil contra el backend real (mismo `AuthService` que la web).
 *
 * La pantalla sigue el diseño de Stitch: marca centrada, campos con etiqueta
 * visible, botón primario cyan, error inline y acceso al registro. El fallo se
 * anuncia con el toast móvil y además queda escrito bajo el formulario, para
 * que no se pierda si el toast ya se cerró.
 */
@Component({
  selector: 'app-mobile-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonSpinner,
  ],
  template: `
    <ion-content class="cd-auth" [fullscreen]="true">
      <main class="cd-auth__inner">
        <div class="cd-auth__bar">
          <span class="cd-auth__pill">
            <span class="cd-auth__dot" aria-hidden="true"></span>
            Sistema activo
          </span>
          <ion-icon class="cd-auth__shield" name="shield-checkmark-outline" aria-hidden="true"></ion-icon>
        </div>

        <header class="cd-auth__brand">
          <svg class="cd-logo" viewBox="0 0 48 48" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M24 7v34M9.3 15.5l29.4 17M9.3 32.5l29.4-17" />
              <path d="M24 7l-3.5 3.5M24 7l3.5 3.5M24 41l-3.5-3.5M24 41l3.5-3.5" />
              <path d="M9.3 15.5l1.2 4.7M9.3 15.5l4.8-.8M38.7 32.5l-1.2-4.7M38.7 32.5l-4.8.8" />
              <path d="M9.3 32.5l4.8.8M9.3 32.5l1.2-4.7M38.7 15.5l-4.8-.8M38.7 15.5l-1.2 4.7" />
            </g>
          </svg>
          <h1 class="cd-wordmark">Cold Day</h1>
          <p class="cd-tagline">Operaciones en frío, en tiempo real.</p>
        </header>

        <form class="cd-auth__form cd-card" [formGroup]="loginForm" (ngSubmit)="enviar()" novalidate>
          <ion-list lines="none" class="cd-form">
            <ion-item>
              <ion-icon slot="start" name="mail-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="correo"
                type="email"
                inputmode="email"
                autocomplete="email"
                label="Correo"
                labelPlacement="stacked"
                data-testid="correo"
              ></ion-input>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" name="lock-closed-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="password"
                [type]="verPassword() ? 'text' : 'password'"
                autocomplete="current-password"
                label="Contraseña"
                labelPlacement="stacked"
                data-testid="password"
              ></ion-input>
              <ion-button
                slot="end"
                fill="clear"
                type="button"
                class="cd-auth__ojo"
                [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                data-testid="toggle-password"
                (click)="alternarPassword()"
              >
                <ion-icon
                  [name]="verPassword() ? 'eye-off-outline' : 'eye-outline'"
                  aria-hidden="true"
                ></ion-icon>
              </ion-button>
            </ion-item>
          </ion-list>

          @if (error(); as mensaje) {
            <p class="cd-auth__error" role="alert" data-testid="error-login">{{ mensaje }}</p>
          }

          <ion-button
            expand="block"
            type="submit"
            class="cd-cta"
            data-testid="entrar"
            [disabled]="loginForm.invalid || loading()"
          >
            @if (loading()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Entrar
            }
          </ion-button>
        </form>

        <p class="cd-auth__link">
          ¿No tenés cuenta?
          <a routerLink="/registro" data-testid="ir-registro">Creá una</a>
        </p>

        <footer class="cd-auth__footer">
          <ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>
          <span>Conexión cifrada de extremo a extremo · Colombia</span>
        </footer>
      </main>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly auth = inject(AuthService);
  private readonly modos = inject(ModoService);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly verPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loginForm = new FormGroup({
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected alternarPassword(): void {
    this.verPassword.update((visible) => !visible);
  }

  protected enviar(): void {
    if (this.loginForm.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    const { correo, password } = this.loginForm.getRawValue();

    this.usuariosApi.login(correo, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        // El backend solo devuelve {token, expiracion, rol}; la sesión se
        // reconstruye desde el JWT igual que en la web.
        this.auth.establecerSesionDesdeToken(res, correo, res.usuario);
        // El modo actual decide el home; una cuenta solo-admin va a "usá la web".
        void this.router.navigateByUrl(this.modos.homeActual() ?? '/solo-web');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        // Nunca el mensaje crudo del backend: `mensajeErrorAccion` traduce el
        // status a copy humana y el 401 tiene su propia frase de login.
        const mensaje = mensajeErrorAccion(err, MENSAJES_LOGIN);
        this.error.set(mensaje);
        void this.toast.error('No pudimos iniciar sesión', mensaje);
      },
    });
  }
}
