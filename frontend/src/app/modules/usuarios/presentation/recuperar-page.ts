import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';

@Component({
  selector: 'app-recuperar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-lg mb-3">
          <mat-icon class="text-3xl">lock_reset</mat-icon>
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
          Recuperar Contraseña
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Restablece el acceso a tu cuenta COLD DAY
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div class="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-200 dark:border-slate-800">
          <!-- Paso 1: Solicitar Token -->
          @if (paso() === 1) {
            <form [formGroup]="solicitarForm" (ngSubmit)="onSolicitarToken()" class="space-y-5">
              <div>
                <label for="correoRec" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ingresa tu Correo Registrado
                </label>
                <input
                  id="correoRec"
                  type="email"
                  formControlName="correo"
                  placeholder="ejemplo@coldday.com.co"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <button
                type="submit"
                [disabled]="solicitarForm.invalid || loading()"
                class="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-md"
              >
                @if (loading()) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                  Enviando token...
                } @else {
                  <mat-icon class="text-sm">send</mat-icon>
                  Enviar Código de Recuperación
                }
              </button>
            </form>
          } @else {
            <!-- Paso 2: Token + Nueva Contraseña -->
            <form [formGroup]="resetForm" (ngSubmit)="onResetPassword()" class="space-y-5">
              <div class="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-300">
                <span class="font-bold">Token generado para demo:</span>
                <code class="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded ml-1 font-bold">{{ tokenSimulado() }}</code>
              </div>

              <div>
                <label for="tokenInput" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código / Token de Seguridad
                </label>
                <input
                  id="tokenInput"
                  type="text"
                  formControlName="token"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                />
              </div>

              <div>
                <label for="nuevaPass" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  id="nuevaPass"
                  type="password"
                  formControlName="nuevaPassword"
                  placeholder="Mínimo 6 caracteres"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <button
                type="submit"
                [disabled]="resetForm.invalid || loading()"
                class="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-md"
              >
                @if (loading()) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                  Actualizando...
                } @else {
                  <mat-icon class="text-sm">check_circle</mat-icon>
                  Establecer Nueva Contraseña
                }
              </button>
            </form>
          }

          <div class="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
            <a routerLink="/login" class="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 inline-flex items-center gap-1">
              <mat-icon class="text-xs">arrow_back</mat-icon>
              Regresar al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecuperarPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly paso = signal<1 | 2>(1);
  readonly tokenSimulado = signal<string>('');
  readonly loading = signal<boolean>(false);

  readonly solicitarForm = new FormGroup({
    correo: new FormControl('maria.gomez@gmail.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    })
  });

  readonly resetForm = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nuevaPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] })
  });

  onSolicitarToken(): void {
    if (this.solicitarForm.invalid) return;

    this.loading.set(true);
    const correo = this.solicitarForm.getRawValue().correo;

    this.usuariosApi.solicitarRecuperacion(correo).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.tokenSimulado.set(res.tokenSimulado || 'CD-RESET-884920');
        this.resetForm.patchValue({ token: res.tokenSimulado || 'CD-RESET-884920' });
        this.paso.set(2);
        this.toast.info('Código Enviado', 'Usa el código generado en pantalla para restablecer tu clave.');
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo enviar el código de recuperación.');
      }
    });
  }

  onResetPassword(): void {
    if (this.resetForm.invalid) return;

    this.loading.set(true);
    const { token, nuevaPassword } = this.resetForm.getRawValue();

    this.usuariosApi.resetPassword(token, nuevaPassword).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success('¡Listo!', res.mensaje);
        this.router.navigate(['/login']);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo actualizar la contraseña.');
      }
    });
  }
}
