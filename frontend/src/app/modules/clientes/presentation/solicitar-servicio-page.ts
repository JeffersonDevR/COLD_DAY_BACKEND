import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ClientesApi } from '../infrastructure/clientes-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { CategoriaServicio } from '../../../core/shared/domain/models/common.models';

interface BarrioCucuta {
  nombre: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-solicitar-servicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <a routerLink="/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <mat-icon class="text-xs">arrow_back</mat-icon> Volver al Panel
          </a>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Solicitar Servicio Técnico
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Ingresa los detalles de la falla para iniciar el broadcast geolocalizado en Cúcuta
          </p>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form [formGroup]="solicitudForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- 1. Selección de Categoría -->
          <div>
            <span class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              1. Selecciona la Línea de Especialidad *
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                (click)="setCategoria('AIRE_ACONDICIONADO')"
                class="p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2"
                [class.border-sky-500]="categoriaActual() === 'AIRE_ACONDICIONADO'"
                [class.bg-sky-50]="categoriaActual() === 'AIRE_ACONDICIONADO'"
                [class.dark:bg-sky-950/40]="categoriaActual() === 'AIRE_ACONDICIONADO'"
                [class.ring-2]="categoriaActual() === 'AIRE_ACONDICIONADO'"
                [class.ring-sky-500/20]="categoriaActual() === 'AIRE_ACONDICIONADO'"
                [class.border-slate-200]="categoriaActual() !== 'AIRE_ACONDICIONADO'"
                [class.dark:border-slate-800]="categoriaActual() !== 'AIRE_ACONDICIONADO'"
              >
                <div class="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                  <mat-icon>mode_fan</mat-icon>
                </div>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Aire Acondicionado</span>
              </button>

              <button
                type="button"
                (click)="setCategoria('REFRIGERACION')"
                class="p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2"
                [class.border-cyan-500]="categoriaActual() === 'REFRIGERACION'"
                [class.bg-cyan-50]="categoriaActual() === 'REFRIGERACION'"
                [class.dark:bg-cyan-950/40]="categoriaActual() === 'REFRIGERACION'"
                [class.ring-2]="categoriaActual() === 'REFRIGERACION'"
                [class.ring-cyan-500/20]="categoriaActual() === 'REFRIGERACION'"
                [class.border-slate-200]="categoriaActual() !== 'REFRIGERACION'"
                [class.dark:border-slate-800]="categoriaActual() !== 'REFRIGERACION'"
              >
                <div class="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 flex items-center justify-center">
                  <mat-icon>kitchen</mat-icon>
                </div>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Refrigeración</span>
              </button>

              <button
                type="button"
                (click)="setCategoria('ELECTRICIDAD')"
                class="p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2"
                [class.border-amber-500]="categoriaActual() === 'ELECTRICIDAD'"
                [class.bg-amber-50]="categoriaActual() === 'ELECTRICIDAD'"
                [class.dark:bg-amber-950/40]="categoriaActual() === 'ELECTRICIDAD'"
                [class.ring-2]="categoriaActual() === 'ELECTRICIDAD'"
                [class.ring-amber-500/20]="categoriaActual() === 'ELECTRICIDAD'"
                [class.border-slate-200]="categoriaActual() !== 'ELECTRICIDAD'"
                [class.dark:border-slate-800]="categoriaActual() !== 'ELECTRICIDAD'"
              >
                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <mat-icon>bolt</mat-icon>
                </div>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Electricidad</span>
              </button>

              <button
                type="button"
                (click)="setCategoria('ELECTRODOMESTICOS')"
                class="p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2"
                [class.border-emerald-500]="categoriaActual() === 'ELECTRODOMESTICOS'"
                [class.bg-emerald-50]="categoriaActual() === 'ELECTRODOMESTICOS'"
                [class.dark:bg-emerald-950/40]="categoriaActual() === 'ELECTRODOMESTICOS'"
                [class.ring-2]="categoriaActual() === 'ELECTRODOMESTICOS'"
                [class.ring-emerald-500/20]="categoriaActual() === 'ELECTRODOMESTICOS'"
                [class.border-slate-200]="categoriaActual() !== 'ELECTRODOMESTICOS'"
                [class.dark:border-slate-800]="categoriaActual() !== 'ELECTRODOMESTICOS'"
              >
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <mat-icon>local_laundry_service</mat-icon>
                </div>
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Electrodomésticos</span>
              </button>
            </div>
          </div>

          <!-- 2. Descripción de la Falla -->
          <div>
            <label for="descripcionFalla" class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              2. Describe la Falla o Ruido Extraño *
            </label>
            <textarea
              id="descripcionFalla"
              rows="3"
              formControlName="descripcionFalla"
              placeholder="Ej. El aire mini-split no enfría la habitación, el compresor exterior arranca y se apaga a los 30 segundos, gotea agua hacia la pared..."
              class="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-sky-500"
            ></textarea>
          </div>

          <!-- 3. Ubicación y Selector en Cúcuta -->
          <div class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <mat-icon class="text-sky-600 text-sm">my_location</mat-icon>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3. Ubicación del Domicilio en Cúcuta *
                </h4>
              </div>
              <span class="text-xs text-slate-400">Radio inicial: 10 km</span>
            </div>

            <!-- Selector rápido de Barrio -->
            <div>
              <span class="text-xs font-medium text-slate-500 block mb-1.5">Seleccionar sector o barrio de referencia:</span>
              <div class="flex flex-wrap gap-2">
                @for (b of barrios; track b.nombre) {
                  <button
                    type="button"
                    (click)="seleccionarBarrio(b)"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                    [class.bg-sky-600]="barrioSeleccionado() === b.nombre"
                    [class.text-white]="barrioSeleccionado() === b.nombre"
                    [class.border-sky-600]="barrioSeleccionado() === b.nombre"
                    [class.bg-white]="barrioSeleccionado() !== b.nombre"
                    [class.dark:bg-slate-800]="barrioSeleccionado() !== b.nombre"
                    [class.text-slate-700]="barrioSeleccionado() !== b.nombre"
                    [class.dark:text-slate-300]="barrioSeleccionado() !== b.nombre"
                    [class.border-slate-300]="barrioSeleccionado() !== b.nombre"
                    [class.dark:border-slate-600]="barrioSeleccionado() !== b.nombre"
                  >
                    {{ b.nombre }}
                  </button>
                }
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="direccion" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Dirección exacta *
                </label>
                <input
                  id="direccion"
                  type="text"
                  formControlName="direccion"
                  placeholder="Ej. Calle 15 # 3E-28"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <span class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Coordenadas GPS Cúcuta (Lat, Lng)
                </span>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    formControlName="latitud"
                    class="w-1/2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                    readonly
                  />
                  <input
                    type="number"
                    step="0.0001"
                    formControlName="longitud"
                    class="w-1/2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                    readonly
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Evidencia fotográfica / URL -->
          <div>
            <label for="evidenciaUrl" class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              4. Foto de Evidencia de la Falla (Opcional)
            </label>
            <div class="flex items-center gap-3">
              <input
                id="evidenciaUrl"
                type="text"
                formControlName="evidenciaUrl"
                placeholder="https://ejemplo.com/foto-falla-aire.jpg o cargar captura"
                class="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                (click)="usarFotoDemo()"
                class="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap"
              >
                Cargar Foto Demo
              </button>
            </div>
          </div>

          <!-- Botón de Envío -->
          <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p class="text-xs text-slate-500">
              Al confirmar, la OT pasará a <strong>Buscando Técnico</strong> mediante broadcast perimetral.
            </p>
            <button
              type="submit"
              [disabled]="solicitudForm.invalid || loading()"
              class="px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2"
            >
              @if (loading()) {
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Iniciando Broadcast...
              } @else {
                <mat-icon class="text-sm">radar</mat-icon>
                Emitir Solicitud de OT
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class SolicitarServicioPage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly categoriaActual = signal<CategoriaServicio>('AIRE_ACONDICIONADO');
  readonly barrioSeleccionado = signal<string>('Los Caobos');
  readonly loading = signal<boolean>(false);

  readonly barrios: BarrioCucuta[] = [
    { nombre: 'Los Caobos', lat: 7.8872, lng: -72.4951 },
    { nombre: 'La Riviera', lat: 7.8911, lng: -72.4933 },
    { nombre: 'Guaimaral', lat: 7.9045, lng: -72.4977 },
    { nombre: 'Prados del Este', lat: 7.8722, lng: -72.4811 },
    { nombre: 'Centro', lat: 7.8928, lng: -72.5052 },
    { nombre: 'Quinta Oriental', lat: 7.8971, lng: -72.4915 }
  ];

  readonly solicitudForm = new FormGroup({
    descripcionFalla: new FormControl('El aire mini-split inverter no enfría, se escucha un zumbido y gotea agua en la unidad interior.', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)]
    }),
    direccion: new FormControl('Calle 14 # 2E-30, Los Caobos', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    latitud: new FormControl(7.8872, { nonNullable: true }),
    longitud: new FormControl(-72.4951, { nonNullable: true }),
    evidenciaUrl: new FormControl('')
  });

  setCategoria(cat: CategoriaServicio): void {
    this.categoriaActual.set(cat);
  }

  seleccionarBarrio(b: BarrioCucuta): void {
    this.barrioSeleccionado.set(b.nombre);
    this.solicitudForm.patchValue({
      direccion: `Barrio ${b.nombre}, Cúcuta`,
      latitud: b.lat,
      longitud: b.lng
    });
  }

  usarFotoDemo(): void {
    this.solicitudForm.patchValue({
      evidenciaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop'
    });
    this.toast.info('Foto cargada', 'Se adjuntó fotografía de evidencia.');
  }

  onSubmit(): void {
    if (this.solicitudForm.invalid) return;

    this.loading.set(true);
    const form = this.solicitudForm.getRawValue();
    const user = this.authService.currentUser();

    this.clientesApi.crearOt(
      {
        categoriaServicio: this.categoriaActual(),
        descripcionFalla: form.descripcionFalla,
        direccion: form.direccion,
        barrio: this.barrioSeleccionado(),
        latitud: form.latitud,
        longitud: form.longitud,
        evidenciaUrls: form.evidenciaUrl ? [form.evidenciaUrl] : []
      },
      String(user?.id || 3),
      user?.nombre || 'Cliente'
    ).subscribe({
      next: (nuevaOt) => {
        this.loading.set(false);
        this.toast.success('Solicitud Creada', `OT ${nuevaOt.id} transmitida por broadcast (10 km)`);
        this.router.navigate(['/cliente/ot', nuevaOt.id]);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo crear la solicitud');
      }
    });
  }
}
