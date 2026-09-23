import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { ThemeService } from '../../../core/shared/presentation/theme.service';

import { Rol } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, InputText, Password, Button],
  template: `
    <div class="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950">
      <!-- Panel de marca (escritorio) -->
      <aside
        class="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-cyan-700 text-white p-10 xl:p-14"
      >
        <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true"></div>
        <div class="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true"></div>

        <!-- Marca -->
        <div class="relative flex items-center gap-3">
          <span class="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <i class="pi pi-sparkles text-xl"></i>
          </span>
          <div>
            <p class="font-black tracking-tight leading-none">COLD DAY S.A.S.</p>
            <p class="text-xs text-white/70 mt-0.5">Plataforma Multiservicios</p>
          </div>
        </div>

        <!-- Propuesta de valor -->
        <div class="relative max-w-md">
          <h1 class="text-3xl xl:text-4xl font-black leading-tight">
            Servicios técnicos a domicilio, <span class="text-cyan-200">al instante</span>.
          </h1>
          <p class="mt-4 text-sm text-white/80 leading-relaxed">
            Conectamos hogares y empresas de Cúcuta con técnicos auditados en refrigeración,
            aire acondicionado, electricidad y electrodomésticos.
          </p>

          <ul class="mt-8 space-y-3 text-sm font-medium">
            <li class="flex items-center gap-3">
              <i class="pi pi-verified text-cyan-200"></i> Técnicos verificados SENA y Policía
            </li>
            <li class="flex items-center gap-3">
              <i class="pi pi-compass text-cyan-200"></i> Seguimiento del técnico en el mapa (radar)
            </li>
            <li class="flex items-center gap-3">
              <i class="pi pi-shield text-cyan-200"></i> Acta de garantía digital de 90 días
            </li>
          </ul>

          <!-- Mini métricas -->
          <div class="mt-8 grid grid-cols-3 gap-3">
            <div class="rounded-2xl bg-white/10 backdrop-blur px-3 py-3">
              <p class="text-2xl font-black leading-none">4.9★</p>
              <p class="text-[11px] text-white/70 mt-1">Reputación media</p>
            </div>
            <div class="rounded-2xl bg-white/10 backdrop-blur px-3 py-3">
              <p class="text-2xl font-black leading-none">90</p>
              <p class="text-[11px] text-white/70 mt-1">Días de garantía</p>
            </div>
            <div class="rounded-2xl bg-white/10 backdrop-blur px-3 py-3">
              <p class="text-2xl font-black leading-none">10 km</p>
              <p class="text-[11px] text-white/70 mt-1">Radio de búsqueda</p>
            </div>
          </div>
        </div>

        <p class="relative text-[11px] text-white/60">
          Cúcuta, Norte de Santander · Cobertura metropolitana
        </p>
      </aside>

      <!-- Panel de formulario -->
      <main class="relative flex flex-col justify-center px-5 sm:px-8 py-12">
        <!-- Acciones superiores -->
        <div class="absolute top-4 right-4 flex items-center gap-2">
          <p-button
            [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            [ariaLabel]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'"
            (onClick)="theme.toggleTheme()"
          />
        </div>

        <div class="mx-auto w-full max-w-md">
          <!-- Marca (móvil) -->
          <div class="lg:hidden text-center mb-8">
            <div
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-lg mb-3"
            >
              <i class="pi pi-sparkles text-3xl"></i>
            </div>
            <h2 class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              COLD DAY <span class="text-sky-500 font-medium text-base">S.A.S.</span>
            </h2>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Plataforma Multiservicios · Cúcuta, Colombia
            </p>
          </div>

          <div
            class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8"
          >
            <h2 class="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              Inicia sesión
            </h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accede a tu panel operativo de COLD DAY.
            </p>

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="mt-6 space-y-5">
              <div>
                <label for="correo" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  pInputText
                  id="correo"
                  type="email"
                  formControlName="correo"
                  autocomplete="email"
                  placeholder="usuario@coldday.com.co"
                  class="w-full"
                />
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label for="password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Contraseña
                  </label>
                  <a
                    routerLink="/recuperar"
                    class="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <p-password
                  inputId="password"
                  formControlName="password"
                  [feedback]="false"
                  [toggleMask]="true"
                  [fluid]="true"
                  autocomplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              <p-button
                type="submit"
                label="Iniciar Sesión"
                icon="pi pi-sign-in"
                [fluid]="true"
                [loading]="loading()"
                [disabled]="loginForm.invalid"
              />
            </form>

            <!-- Acceso rápido DEMO -->
            <div class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Acceso Rápido Demo
                </span>
                <span
                  class="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold"
                >
                  demo1234
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  (click)="quickLogin('cliente1@coldday.com.co', 'CLIENTE')"
                  class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-colors text-left"
                >
                  <span class="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-user text-sm"></i>
                  </span>
                  <span class="min-w-0">
                    <span class="block font-bold text-slate-800 dark:text-slate-200 truncate">Cliente</span>
                    <span class="block text-[11px] text-slate-500 truncate">María Gómez</span>
                  </span>
                </button>

                <button
                  type="button"
                  (click)="quickLogin('tecnico1@coldday.com.co', 'TECNICO')"
                  class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-colors text-left"
                >
                  <span class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-wrench text-sm"></i>
                  </span>
                  <span class="min-w-0">
                    <span class="block font-bold text-slate-800 dark:text-slate-200 truncate">Técnico</span>
                    <span class="block text-[11px] text-slate-500 truncate">Juan Pérez</span>
                  </span>
                </button>

                <button
                  type="button"
                  (click)="quickLogin('tecnico2@coldday.com.co', 'TECNICO')"
                  class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-colors text-left"
                >
                  <span class="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-wrench text-sm"></i>
                  </span>
                  <span class="min-w-0">
                    <span class="block font-bold text-slate-800 dark:text-slate-200 truncate">Técnico 2</span>
                    <span class="block text-[11px] text-slate-500 truncate">Andrés Suárez</span>
                  </span>
                </button>

                <button
                  type="button"
                  (click)="quickLogin('admin@coldday.com.co', 'ADMINISTRADOR')"
                  class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:border-violet-300 transition-colors text-left"
                >
                  <span class="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900 text-violet-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-cog text-sm"></i>
                  </span>
                  <span class="min-w-0">
                    <span class="block font-bold text-slate-800 dark:text-slate-200 truncate">Administrador</span>
                    <span class="block text-[11px] text-slate-500 truncate">Carlos Méndez</span>
                  </span>
                </button>

                <button
                  type="button"
                  (click)="quickLogin('proveedor1@coldday.com.co', 'PROVEEDOR')"
                  class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 transition-colors text-left"
                >
                  <span class="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-600 flex items-center justify-center shrink-0">
                    <i class="pi pi-truck text-sm"></i>
                  </span>
                  <span class="min-w-0">
                    <span class="block font-bold text-slate-800 dark:text-slate-200 truncate">Proveedor</span>
                    <span class="block text-[11px] text-slate-500 truncate">Suministros del Norte</span>
                  </span>
                </button>
              </div>
            </div>

            <p class="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
              ¿No tienes una cuenta aún?
              <a routerLink="/registro" class="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 ml-1">
                Regístrate gratis
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  `,
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
