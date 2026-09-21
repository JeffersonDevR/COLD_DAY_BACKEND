import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';

import { Rol } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <!-- Logo COLD DAY -->
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-lg mb-4">
          <mat-icon class="text-4xl">ac_unit</mat-icon>
        </div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          COLD DAY <span class="text-sky-500 font-medium text-lg">S.A.S.</span>
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Plataforma Tecnológica Multiservicios • Cúcuta, Colombia
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div class="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-200 dark:border-slate-800">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-5">
            <div>
              <label for="correo" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div class="relative">
                <input
                  id="correo"
                  type="email"
                  formControlName="correo"
                  placeholder="usuario@coldday.com.co"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Contraseña
                </label>
                <a routerLink="/recuperar" class="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div class="relative">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-all pr-10"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <mat-icon class="text-lg">{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>

            <button
              type="submit"
              [disabled]="loading() || loginForm.invalid"
              class="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
            >
              @if (loading()) {
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Iniciando sesión...
              } @else {
                <mat-icon class="text-sm">login</mat-icon>
                Iniciar Sesión
              }
            </button>
          </form>

          <!-- Acceso Rápido DEMO -->
          <div class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Acceso Rápido para Pruebas Demo
              </span>
              <span class="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                Backend API · demo1234
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                (click)="quickLogin('cliente1@coldday.com.co', 'CLIENTE')"
                class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left transition-colors"
              >
                <div class="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-600 flex items-center justify-center shrink-0">
                  <mat-icon class="text-sm">person</mat-icon>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-slate-200 truncate">Cliente</div>
                  <div class="text-[11px] text-slate-500 truncate">María Gómez</div>
                </div>
              </button>

              <button
                type="button"
                (click)="quickLogin('tecnico1@coldday.com.co', 'TECNICO')"
                class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left transition-colors"
              >
                <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 flex items-center justify-center shrink-0">
                  <mat-icon class="text-sm">handyman</mat-icon>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-slate-200 truncate">Técnico Libre</div>
                  <div class="text-[11px] text-slate-500 truncate">Juan Pérez</div>
                </div>
              </button>

              <button
                type="button"
                (click)="quickLogin('tecnico2@coldday.com.co', 'TECNICO')"
                class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition-colors"
              >
                <div class="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600 flex items-center justify-center shrink-0">
                  <mat-icon class="text-sm">handyman</mat-icon>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-slate-200 truncate">Técnico 2</div>
                  <div class="text-[11px] text-slate-500 truncate">Andrés Suárez</div>
                </div>
              </button>

              <button
                type="button"
                (click)="quickLogin('admin@coldday.com.co', 'ADMINISTRADOR')"
                class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-left transition-colors"
              >
                <div class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-600 flex items-center justify-center shrink-0">
                  <mat-icon class="text-sm">admin_panel_settings</mat-icon>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-slate-200 truncate">Administrador</div>
                  <div class="text-[11px] text-slate-500 truncate">Carlos Méndez</div>
                </div>
              </button>
            </div>
          </div>

          <div class="mt-6 text-center">
            <p class="text-xs text-slate-600 dark:text-slate-400">
              ¿No tienes una cuenta aún?
              <a routerLink="/registro" class="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 ml-1">
                Regístrate gratis
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly authService = inject(AuthService);

  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly showPassword = signal<boolean>(false);
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
