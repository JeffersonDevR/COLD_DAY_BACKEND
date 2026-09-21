import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { TipoDocumentoTecnico, DocumentoTecnicoResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-perfil-documentos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div>
        <a routerLink="/tecnico/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <mat-icon class="text-xs">arrow_back</mat-icon> Volver al Panel Técnico
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Documentación y Acreditaciones
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Auditoría de antecedentes, cédula, RUT y certificaciones SENA / Matrícula CONTE
        </p>
      </div>

      <!-- Semáforo Explicativo -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span class="font-bold">Verde: Vigente (> 30 días)</span>
        </div>
        <div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-amber-500"></span>
          <span class="font-bold">Amarillo: Por vencer (&lt; 30 días)</span>
        </div>
        <div class="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-rose-500"></span>
          <span class="font-bold">Rojo: Vencido / Inhabilita</span>
        </div>
      </div>

      <!-- Lista de Documentos Cargados -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Expediente del Técnico</h2>
          <button
            type="button"
            (click)="mostrarForm.set(!mostrarForm())"
            class="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs transition-colors"
          >
            <mat-icon class="text-xs">upload_file</mat-icon>
            Subir Nuevo Documento
          </button>
        </div>

        <!-- Formulario Desplegable para Subir Documento -->
        @if (mostrarForm()) {
          <form [formGroup]="docForm" (ngSubmit)="onSubirDoc()" class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4 mb-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Cargar Archivo al Expediente</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label for="tipo-doc" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo de Documento *</label>
                <select id="tipo-doc" formControlName="tipo" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
                  <option value="CEDULA">Cédula de Ciudadanía</option>
                  <option value="RUT">RUT Dian</option>
                  <option value="ANTECEDENTES_POLICIA">Antecedentes Policía Nacional</option>
                  <option value="CERTIFICACION_SENA">Certificación SENA</option>
                  <option value="MATRICULA_CONTE">Matrícula CONTE (Electricistas)</option>
                  <option value="OTRO">Otro Documento</option>
                </select>
              </div>

              <div>
                <label for="fecha-vencimiento" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de Vencimiento *</label>
                <input id="fecha-vencimiento" type="date" formControlName="fechaVencimiento" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
              </div>

              <div>
                <label for="archivo-url" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">URL / Archivo *</label>
                <input id="archivo-url" type="text" formControlName="archivoUrl" placeholder="https://almacen.com/doc.pdf" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button type="button" (click)="mostrarForm.set(false)" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600">Cancelar</button>
              <button type="submit" [disabled]="docForm.invalid" class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs">Guardar Documento</button>
            </div>
          </form>
        }

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (doc of documentos(); track doc.id) {
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0"
                  [class.bg-emerald-600]="doc.semaforo === 'VERDE'"
                  [class.bg-amber-500]="doc.semaforo === 'AMARILLO'"
                  [class.bg-rose-500]="doc.semaforo === 'ROJO'"
                >
                  <mat-icon class="text-lg">
                    @switch (doc.semaforo) {
                      @case ('VERDE') { verified }
                      @case ('AMARILLO') { warning }
                      @case ('ROJO') { error }
                    }
                  </mat-icon>
                </div>
                <div>
                  <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ doc.tipo.replace('_', ' ') }}</h4>
                  <p class="text-[11px] text-slate-500">Vence: {{ doc.fechaVencimiento }}</p>
                  <span
                    class="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                    [class.bg-emerald-100]="doc.semaforo === 'VERDE'"
                    [class.text-emerald-800]="doc.semaforo === 'VERDE'"
                    [class.bg-amber-100]="doc.semaforo === 'AMARILLO'"
                    [class.text-amber-800]="doc.semaforo === 'AMARILLO'"
                    [class.bg-rose-100]="doc.semaforo === 'ROJO'"
                    [class.text-rose-800]="doc.semaforo === 'ROJO'"
                  >
                    {{ doc.semaforo === 'VERDE' ? 'Vigente y Aprobado' : (doc.semaforo === 'AMARILLO' ? 'Por Vencer (< 30 días)' : 'Documento Vencido') }}
                  </span>
                </div>
              </div>

              <a
                [href]="doc.archivoUrl"
                target="_blank"
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1"
              >
                <mat-icon class="text-xs" style="font-size:14px; width:14px; height:14px;">visibility</mat-icon>
                Ver
              </a>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class PerfilDocumentosPage {
  private readonly mockDb = inject(MockDbService);
  private readonly authService = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly mostrarForm = signal<boolean>(false);

  readonly tecnico = computed(() => {
    const user = this.authService.currentUser();
    const tecId = String(user?.id || 1);
    return this.mockDb.tecnicos().find(t => t.id === tecId || t.correo === user?.correo);
  });

  readonly documentos = computed<DocumentoTecnicoResponse[]>(() => {
    return this.tecnico()?.documentos || [];
  });

  readonly docForm = new FormGroup({
    tipo: new FormControl<TipoDocumentoTecnico>('CERTIFICACION_SENA', { nonNullable: true }),
    fechaVencimiento: new FormControl('2027-12-31', { nonNullable: true, validators: [Validators.required] }),
    archivoUrl: new FormControl('https://coldday.com.co/docs/certificacion.pdf', { nonNullable: true, validators: [Validators.required] })
  });

  onSubirDoc(): void {
    if (this.docForm.invalid) return;
    const t = this.tecnico();
    if (!t) return;

    const val = this.docForm.getRawValue();
    this.tecnicosApi.subirDocumento(t.id, val.tipo, val.archivoUrl, val.fechaVencimiento).subscribe({
      next: () => {
        this.toast.success('Documento Adjuntado', 'El archivo ha sido enviado para verificación del administrador.');
        this.mostrarForm.set(false);
      }
    });
  }
}
