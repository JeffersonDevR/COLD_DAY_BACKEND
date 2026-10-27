import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/service/auth.service';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ToastService } from '../../core/alertas/toast.service';
import { mensajeErrorAccion } from '../../core/alertas/mensaje-error';

/** Copy propia: en el login un 401 son credenciales que no matchean, no sesión expirada. */
const MENSAJES_LOGIN: Record<number, string> = {
  401: 'Credenciales incorrectas. Verificá tu correo y tu contraseña.',
};

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, InputText, Password, Button],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly authService = inject(AuthService);

  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal<boolean>(false);

  readonly loginForm = new FormGroup({
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)]
    })
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    const { correo, password } = this.loginForm.getRawValue();

    this.usuariosApi.login(correo, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        // El backend solo devuelve {token, expiracion, rol}; la sesión se
        // reconstruye desde el JWT. El mock además entrega `usuario`.
        const usuario = this.authService.establecerSesionDesdeToken(res, correo, res.usuario);
        this.toast.success('¡Bienvenido!', `Sesión iniciada como ${usuario.nombre}`);
        const target = this.authService.getDashboardRouteForRole(usuario.rol);
        this.router.navigate([target]);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Error de autenticación', mensajeErrorAccion(err, MENSAJES_LOGIN));
      }
    });
  }
}
