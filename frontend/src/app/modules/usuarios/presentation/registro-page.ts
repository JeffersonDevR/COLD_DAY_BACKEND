import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap } from 'rxjs/operators';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ClientesApi } from '../../clientes/infrastructure/clientes-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { Rol, CategoriaServicio, TokenResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-registro-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div class="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white shadow-lg mb-3">
          <i class="pi pi-user-plus text-3xl"></i>
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
          Únete a COLD DAY
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Crea tu cuenta de intermediación técnica en Cúcuta y Norte de Santander
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div class="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-200 dark:border-slate-800">
          <form [formGroup]="registroForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <!-- Selector de Rol -->
            <div>
              <span class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                ¿Cómo deseas usar la plataforma?
              </span>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  (click)="selectedRol.set('CLIENTE')"
                  class="flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all"
                  [class.border-sky-500]="selectedRol() === 'CLIENTE'"
                  [class.bg-sky-50]="selectedRol() === 'CLIENTE'"
                  [class.dark:bg-sky-950/40]="selectedRol() === 'CLIENTE'"
                  [class.ring-2]="selectedRol() === 'CLIENTE'"
                  [class.ring-sky-500/20]="selectedRol() === 'CLIENTE'"
                  [class.border-slate-200]="selectedRol() !== 'CLIENTE'"
                  [class.dark:border-slate-700]="selectedRol() !== 'CLIENTE'"
                >
                  <div class="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0">
                    <i class="pi pi-wrench"></i>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Cliente</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Necesito servicios técnicos</p>
                  </div>
                </button>

                <button
                  type="button"
                  (click)="selectedRol.set('TECNICO')"
                  class="flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all"
                  [class.border-cyan-500]="selectedRol() === 'TECNICO'"
                  [class.bg-cyan-50]="selectedRol() === 'TECNICO'"
                  [class.dark:bg-cyan-950/40]="selectedRol() === 'TECNICO'"
                  [class.ring-2]="selectedRol() === 'TECNICO'"
                  [class.ring-cyan-500/20]="selectedRol() === 'TECNICO'"
                  [class.border-slate-200]="selectedRol() !== 'TECNICO'"
                  [class.dark:border-slate-700]="selectedRol() !== 'TECNICO'"
                >
                  <div class="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
                    <i class="pi pi-wrench"></i>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">Técnico</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Prestar servicios certificados</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Campos Básicos -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="nombre" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  id="nombre"
                  type="text"
                  formControlName="nombre"
                  placeholder="Ej. Juan Manuel Pérez"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label for="telefono" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono Celular *
                </label>
                <input
                  id="telefono"
                  type="tel"
                  formControlName="telefono"
                  placeholder="Ej. 3123456789"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label for="correo" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico *
              </label>
              <input
                id="correo"
                type="email"
                formControlName="correo"
                placeholder="ejemplo@correo.com"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label for="password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contraseña (mínimo 6 caracteres) *
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                placeholder="••••••••"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <!-- Especialidades si es TÉCNICO -->
            @if (selectedRol() === 'TECNICO') {
              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div class="flex items-center gap-2">
                  <i class="pi pi-list-check text-sky-600 text-sm"></i>
                  <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">Líneas de Especialidad Técnica</h4>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <label class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" (change)="toggleEspecialidad('AIRE_ACONDICIONADO')" [checked]="hasEspecialidad('AIRE_ACONDICIONADO')" class="rounded text-sky-600" />
                    <span>Aire Acondicionado</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" (change)="toggleEspecialidad('REFRIGERACION')" [checked]="hasEspecialidad('REFRIGERACION')" class="rounded text-sky-600" />
                    <span>Refrigeración</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" (change)="toggleEspecialidad('ELECTRICIDAD')" [checked]="hasEspecialidad('ELECTRICIDAD')" class="rounded text-sky-600" />
                    <span>Electricidad</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input type="checkbox" (change)="toggleEspecialidad('ELECTRODOMESTICOS')" [checked]="hasEspecialidad('ELECTRODOMESTICOS')" class="rounded text-sky-600" />
                    <span>Electrodomésticos</span>
                  </label>
                </div>
                <div>
                  <label for="numeroIdentificacion" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Número de identificación (cédula) *
                  </label>
                  <input
                    id="numeroIdentificacion"
                    type="text"
                    formControlName="numeroIdentificacion"
                    placeholder="Ej. 1098765001"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <p class="text-[11px] text-slate-500">Nota: Al registrarte como técnico, tus documentos (cédula y certificaciones) pasarán a validación administrativa previa a operar.</p>
              </div>
            }

            <!-- Checkbox Habeas Data OBLIGATORIO (Ley 1581) -->
            <div class="pt-2">
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  formControlName="aceptaHabeasData"
                  class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Autorizo el tratamiento de mis datos personales de acuerdo con la <strong>Ley 1581 de 2012 (Habeas Data)</strong> de Colombia y la política de privacidad de COLD DAY S.A.S. para fines operativos de intermediación técnica y geolocalización. *
                </span>
              </label>
              @if (registroForm.get('aceptaHabeasData')?.touched && registroForm.get('aceptaHabeasData')?.invalid) {
                <p class="text-xs text-rose-500 mt-1">Debes aceptar el tratamiento de datos para continuar.</p>
              }
            </div>

            <button
              type="submit"
              [disabled]="loading() || registroForm.invalid"
              class="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              @if (loading()) {
                <i class="pi pi-sync animate-spin text-sm"></i>
                Registrando cuenta...
              } @else {
                <i class="pi pi-id-card text-sm"></i>
                Crear Mi Cuenta
              }
            </button>
          </form>

          <div class="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
            ¿Ya tienes una cuenta registrada?
            <a routerLink="/login" class="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 ml-1">
              Iniciar Sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegistroPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly apiConfig = inject(ApiConfig);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly selectedRol = signal<Rol>('CLIENTE');
  readonly especialidades = signal<CategoriaServicio[]>(['AIRE_ACONDICIONADO', 'REFRIGERACION']);
  readonly loading = signal<boolean>(false);

  readonly registroForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(7)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    numeroIdentificacion: new FormControl('', { nonNullable: true }),
    aceptaHabeasData: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
  });

  toggleEspecialidad(cat: CategoriaServicio): void {
    const list = this.especialidades();
    if (list.includes(cat)) {
      this.especialidades.set(list.filter(c => c !== cat));
    } else {
      this.especialidades.set([...list, cat]);
    }
  }

  hasEspecialidad(cat: CategoriaServicio): boolean {
    return this.especialidades().includes(cat);
  }

  onSubmit(): void {
    if (this.registroForm.invalid) return;

    const formVal = this.registroForm.getRawValue();
    const rol = this.selectedRol();

    if (rol === 'TECNICO' && !formVal.numeroIdentificacion.trim()) {
      this.toast.error('Falta la cédula', 'Ingresa tu número de identificación para registrarte como técnico.');
      return;
    }

    this.loading.set(true);

    // Modo mock: alta en memoria + sesión simulada (comportamiento previo).
    if (this.apiConfig.useMocks()) {
      this.usuariosApi.registro({
        nombre: formVal.nombre,
        correo: formVal.correo,
        telefono: formVal.telefono,
        password: formVal.password,
        rol,
        aceptaHabeasData: formVal.aceptaHabeasData
      }).subscribe({
        next: (user) => {
          this.loading.set(false);
          this.authService.setCurrentUser(user);
          this.toast.success('Cuenta Creada Exitosamente', `Bienvenido a COLD DAY, ${user.nombre}`);
          this.router.navigate([this.authService.getDashboardRouteForRole(user.rol)]);
        },
        error: (err: Error) => this.errorAlta(err),
      });
      return;
    }

    // TÉCNICO: /api/tecnicos crea Usuario + perfil en una sola llamada (endpoint público).
    if (rol === 'TECNICO') {
      this.tecnicosApi.registrar({
        nombre: formVal.nombre,
        correo: formVal.correo,
        password: formVal.password,
        telefono: formVal.telefono,
        numeroIdentificacion: formVal.numeroIdentificacion,
        categoriasServicio: this.especialidades(),
        certificaciones: [],
        aceptaHabeasData: formVal.aceptaHabeasData,
      }).pipe(
        switchMap(() => this.usuariosApi.login(formVal.correo, formVal.password)),
      ).subscribe({
        next: (res) => this.completarAlta(res, formVal.correo),
        error: (err: Error) => this.errorAlta(err),
      });
      return;
    }

    // CLIENTE: alta atómica en /api/clientes (Usuario + perfil) → login real.
    // Ya no se hacen dos pasos ni se usa el token mock.
    this.clientesApi.registrarCliente({
      nombre: formVal.nombre,
      correo: formVal.correo,
      password: formVal.password,
      telefono: formVal.telefono,
      tipoCliente: 'B2C',
      calle: 'Por definir',
      ciudad: 'Cúcuta',
      ubicacion: { latitud: 7.8939, longitud: -72.5078 },
      aceptaHabeasData: formVal.aceptaHabeasData,
    }).pipe(
      switchMap(() => this.usuariosApi.login(formVal.correo, formVal.password)),
    ).subscribe({
      next: (res) => this.completarAlta(res, formVal.correo),
      error: (err: Error) => this.errorAlta(err),
    });
  }

  private completarAlta(res: TokenResponse, correo: string): void {
    this.loading.set(false);
    const usuario = this.authService.establecerSesionDesdeToken(res, correo);
    this.toast.success('Cuenta Creada Exitosamente', `Bienvenido a COLD DAY, ${usuario.nombre}`);
    this.router.navigate([this.authService.getDashboardRouteForRole(usuario.rol)]);
  }

  private errorAlta(err: Error): void {
    this.loading.set(false);
    this.toast.error('Error al registrar', err.message || 'Por favor intenta nuevamente.');
  }
}
