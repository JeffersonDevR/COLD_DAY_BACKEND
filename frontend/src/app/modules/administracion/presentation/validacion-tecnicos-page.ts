import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../infrastructure/admin-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { TecnicoResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-validacion-tecnicos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-6xl mx-auto">
      <div>
        <a routerLink="/admin/dashboard" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <i class="pi pi-arrow-left text-xs"></i> Volver a la Torre de Control
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Auditoría y Validación de Expedientes Técnicos
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Verificación de identidad, antecedentes policiales y matrículas profesionales SENA / CONTE
        </p>
      </div>

      <!-- Lista de Técnicos -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (tec of tecnicos(); track tec.id) {
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-lg">
                  {{ (tec.nombreCompleto || tec.nombre || 'T').charAt(0) }}
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ tec.nombreCompleto || tec.nombre }}</h3>
                  <p class="text-xs text-slate-500">CC: {{ tec.cedula || tec.numeroIdentificacion }} • Tel: {{ tec.telefono }}</p>
                  <p class="text-xs text-slate-400">{{ tec.correo }}</p>
                </div>
              </div>

              <span
                class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                [class.bg-emerald-100]="tec.estadoValidacion === 'APROBADO'"
                [class.text-emerald-800]="tec.estadoValidacion === 'APROBADO'"
                [class.bg-amber-100]="tec.estadoValidacion === 'PENDIENTE' || tec.estadoValidacion === 'EN_REVISION'"
                [class.text-amber-800]="tec.estadoValidacion === 'PENDIENTE' || tec.estadoValidacion === 'EN_REVISION'"
                [class.bg-rose-100]="tec.estadoValidacion === 'RECHAZADO'"
                [class.text-rose-800]="tec.estadoValidacion === 'RECHAZADO'"
              >
                {{ tec.estadoValidacion }}
              </span>
            </div>

            <!-- Especialidades -->
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Especialidades:</span>
              <div class="flex flex-wrap gap-1.5">
                @for (cat of tec.categorias; track cat) {
                  <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {{ cat.replace('_', ' ') }}
                  </span>
                }
              </div>
            </div>

            <!-- Documentos y Semáforo de Vigencias -->
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
              <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Expediente de Cumplimiento:</span>
              @for (doc of tec.documentos; track doc.id) {
                <div class="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      [class.bg-emerald-500]="doc.semaforo === 'VERDE'"
                      [class.bg-amber-500]="doc.semaforo === 'AMARILLO'"
                      [class.bg-rose-500]="doc.semaforo === 'ROJO'"
                    ></span>
                    <span class="font-medium text-slate-800 dark:text-slate-200">{{ doc.tipo.replace('_', ' ') }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-slate-400">Vence: {{ doc.fechaVencimiento }}</span>
                    <a [href]="doc.archivoUrl" target="_blank" class="text-sky-600 hover:underline text-[11px]">Ver</a>
                  </div>
                </div>
              }
            </div>

            <!-- Acciones Administrativas de Aprobación/Rechazo -->
            <div class="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="abrirModalRechazo(tec)"
                class="px-3.5 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors"
              >
                Rechazar
              </button>

              <button
                type="button"
                (click)="aprobar(tec)"
                class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1"
              >
                <i class="pi pi-check text-xs"></i>
                Aprobar y Habilitar
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Modal de Rechazo -->
      @if (tecnicoARechazar(); as t) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 class="text-base font-bold text-rose-600">Rechazar Validación de {{ t.nombreCompleto }}</h3>
            <p class="text-xs text-slate-500">Indica el motivo o documento con inconformidades para notificar al técnico:</p>
            <textarea
              rows="3"
              [formControl]="motivoCtrl"
              placeholder="Ej. Antecedentes judiciales con fecha de expedición mayor a 30 días, o RUT sin actividad económica correcta..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-rose-500"
            ></textarea>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="tecnicoARechazar.set(null)" class="px-3 py-1.5 text-xs text-slate-500">Cancelar</button>
              <button
                type="button"
                [disabled]="motivoCtrl.invalid"
                (click)="confirmarRechazo()"
                class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ValidacionTecnicosPage {
  private readonly adminApi = inject(AdminApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly tecnicos = signal<TecnicoResponse[]>([]);
  readonly tecnicoARechazar = signal<TecnicoResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  constructor() {
    this.cargarTecnicos();
  }

  private cargarTecnicos(): void {
    this.tecnicosApi.getTecnicos().subscribe({
      next: (tecnicos) => this.tecnicos.set(tecnicos),
      error: () => this.tecnicos.set([]),
    });
  }

  aprobar(tec: TecnicoResponse): void {
    this.adminApi.validarDocumentacionTecnico(tec.id, 'APROBADO').subscribe({
      next: () => {
        this.toast.success('Técnico Aprobado', `${tec.nombreCompleto} ha sido habilitado para tomar servicios en Cúcuta.`);
        this.cargarTecnicos();
      }
    });
  }

  abrirModalRechazo(tec: TecnicoResponse): void {
    this.tecnicoARechazar.set(tec);
  }

  confirmarRechazo(): void {
    const tec = this.tecnicoARechazar();
    if (!tec || this.motivoCtrl.invalid) return;

    this.adminApi.validarDocumentacionTecnico(tec.id, 'RECHAZADO', this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Técnico Rechazado', `Se notificó el motivo a ${tec.nombreCompleto}.`);
        this.tecnicoARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargarTecnicos();
      }
    });
  }
}
