import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/service/auth.service';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ThemeService } from '../../core/service/theme.service';

import { Rol } from '../../core/models/common.models';

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
  readonly theme = inject(ThemeService);

  readonly loading = signal<boolean>(false);

  readonly loginForm = new FormGroup({
    correo: new FormControl('maria.gomez@gmail.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl('demo1234', {
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
        this.toast.error('Error de autenticación', err.message || 'Verifica tus credenciales');
      }
    });
  }

  /** Acceso rápido contra la API real usando las credenciales del seed (demo1234). */
  quickLogin(correo: string, rol: Rol): void {
    this.loading.set(true);
    this.usuariosApi.login(correo, 'demo1234').subscribe({
      next: (res) => {
        this.loading.set(false);
        const usuario = this.authService.establecerSesionDesdeToken(res, correo, res.usuario);
        this.toast.success(`Acceso Demo (${rol})`, `Ingresaste como ${usuario.nombre}`);
        this.router.navigate([this.authService.getDashboardRouteForRole(usuario.rol)]);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.toast.error('Acceso Demo', err.message || 'No se pudo iniciar sesión demo');
      },
    });
  }
}
