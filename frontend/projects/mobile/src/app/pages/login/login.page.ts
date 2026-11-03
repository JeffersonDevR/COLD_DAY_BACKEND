import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
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

/** A1 — Login móvil contra el backend real (mismo AuthService que la web). */
@Component({
  selector: 'app-mobile-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, IonContent, IonInput, IonItem, IonList, IonSpinner],
  template: `
    <ion-content class="ion-padding">
      <section class="cd-card cd-login">
        <p class="cd-eyebrow">Cold Day</p>
        <h1 class="cd-headline">Ingresá a tu cuenta</h1>
        <p class="cd-muted">
          Servicios técnicos de refrigeración, aire acondicionado y electricidad.
        </p>

        <form [formGroup]="loginForm" (ngSubmit)="enviar()">
          <ion-list lines="none" class="cd-form">
            <ion-item>
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
              <ion-input
                formControlName="password"
                type="password"
                autocomplete="current-password"
                label="Contraseña"
                labelPlacement="stacked"
                data-testid="password"
              ></ion-input>
            </ion-item>
          </ion-list>

          <ion-button
            expand="block"
            type="submit"
            data-testid="entrar"
            [disabled]="loginForm.invalid || loading()"
            (click)="enviar()"
          >
            @if (loading()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Entrar
            }
          </ion-button>
        </form>
      </section>
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

  protected enviar(): void {
    if (this.loginForm.invalid || this.loading()) return;

    this.loading.set(true);
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
        void this.toast.error('No pudimos iniciar sesión', mensajeErrorAccion(err, MENSAJES_LOGIN));
      },
    });
  }
}
