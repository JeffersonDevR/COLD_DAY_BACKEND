import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LiquidacionApi } from '../../liquidacion/infrastructure/liquidacion-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { LiquidacionResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-consignaciones-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-6xl mx-auto">
      <div>
        <a routerLink="/admin/dashboard" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <i class="pi pi-arrow-left text-xs"></i> Volver a la Torre de Control
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Conciliación Contable de Consignaciones
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Auditoría de transferencias Bancolombia/Nequi de la comisión del {{ comisionPorcentaje }}% y desbloqueo automático de técnicos
        </p>
      </div>

      <!-- Resumen de Conciliación -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Comprobantes en Verificación</span>
          <div class="text-2xl font-black text-amber-500 mt-1">
            {{ enVerificacion().length }}
          </div>
          <span class="text-[11px] text-slate-400">Pendientes por conciliar extracto</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Técnicos Bloqueados por Deuda</span>
          <div class="text-2xl font-black text-rose-600 mt-1">
            {{ tecnicosBloqueados().length }}
          </div>
          <span class="text-[11px] text-slate-400">Con servicios en mora</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Total Recaudo Conciliado Mes</span>
          <div class="text-2xl font-black text-emerald-600 mt-1">
            $ {{ totalComisionesAprobadas().toLocaleString('es-CO') }} COP
          </div>
          <span class="text-[11px] text-slate-400">Comisiones ingresadas en firme</span>
        </div>
      </div>

      <!-- Cola de Conciliación -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Cola de Liquidaciones</h2>
          <span class="text-xs text-slate-400">{{ liquidaciones().length }} registros totales</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider">
              <tr>
                <th class="p-3 rounded-l-xl">ID / OT</th>
                <th class="p-3">Técnico</th>
                <th class="p-3">Monto Servicio</th>
                <th class="p-3">Comisión {{ comisionPorcentaje }}%</th>
                <th class="p-3">Comprobante / Referencia</th>
                <th class="p-3">Estado</th>
                <th class="p-3 rounded-r-xl text-right">Acción Contable</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (liq of liquidaciones(); track liq.id) {
                <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3 font-mono font-bold">
                    {{ liq.id }}
                    <span class="block text-[11px] text-slate-400">OT: {{ liq.otId }}</span>
                  </td>
                  <td class="p-3 font-semibold">{{ liq.tecnicoNombre }}</td>
                  <td class="p-3">$ {{ liq.montoServicio.toLocaleString('es-CO') }}</td>
                  <td class="p-3 font-extrabold text-sky-600">$ {{ liq.comision.toLocaleString('es-CO') }}</td>
                  <td class="p-3">
                    @if (liq.referenciaPago) {
                      <div class="space-y-0.5">
                        <span class="font-mono font-bold text-slate-800 dark:text-slate-200">{{ liq.referenciaPago }}</span>
                        @if (liq.comprobanteUrl) {
                          <a [href]="liq.comprobanteUrl" target="_blank" class="block text-sky-600 hover:underline text-[11px]">
                            Ver Recibo Bancario
                          </a>
                        }
                      </div>
                    } @else {
                      <span class="text-slate-400 italic">Sin comprobante subido</span>
                    }
                  </td>
                  <td class="p-3">
                    <span
                      class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      [class.bg-amber-100]="liq.estado === 'EN_VERIFICACION'"
                      [class.text-amber-800]="liq.estado === 'EN_VERIFICACION'"
                      [class.bg-rose-100]="liq.estado === 'PENDIENTE_CONSIGNACION'"
                      [class.text-rose-800]="liq.estado === 'PENDIENTE_CONSIGNACION'"
                      [class.bg-emerald-100]="liq.estado === 'APROBADA'"
                      [class.text-emerald-800]="liq.estado === 'APROBADA'"
                      [class.bg-slate-100]="liq.estado === 'RECHAZADA'"
                      [class.text-slate-800]="liq.estado === 'RECHAZADA'"
                    >
                      {{ liq.estado }}
                    </span>
                  </td>
                  <td class="p-3 text-right">
                    @if (liq.estado === 'EN_VERIFICACION' || liq.estado === 'PENDIENTE_CONSIGNACION') {
                      <div class="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="aprobar(liq)"
                          class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                        >
                          Aprobar & Desbloquear
                        </button>
                        <button
                          type="button"
                          (click)="abrirRechazo(liq)"
                          class="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                        >
                          Rechazar
                        </button>
                      </div>
                    } @else if (liq.estado === 'APROBADA') {
                      <span class="text-emerald-600 font-bold text-xs inline-flex items-center gap-1">
                        <i class="pi pi-check-circle text-xs" style="font-size: 14px; width:14px; height:14px;"></i>
                        Conciliado
                      </span>
                    } @else {
                      <span class="text-rose-600 font-bold text-xs">Rechazado</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal de Rechazo -->
      @if (liqARechazar(); as l) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 class="text-base font-bold text-rose-600">Rechazar Comprobante de {{ l.tecnicoNombre }}</h3>
            <p class="text-xs text-slate-500">Indica el motivo de la inconsistencia en el extracto bancario:</p>
            <textarea
              rows="3"
              [formControl]="motivoCtrl"
              placeholder="Ej. Valor consignado no coincide con los $ 15.000 de comisión, o referencia ilegible..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-rose-500"
            ></textarea>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="liqARechazar.set(null)" class="px-3 py-1.5 text-xs text-slate-500">Cancelar</button>
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
export class ConsignacionesAdminPage {
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly liquidaciones = signal<LiquidacionResponse[]>([]);
  readonly tecnicos = signal<TecnicoResponse[]>([]);

  readonly enVerificacion = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'EN_VERIFICACION')
  );

  readonly tecnicosBloqueados = computed(() =>
    this.tecnicos().filter(t => t.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION')
  );

  readonly totalComisionesAprobadas = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'APROBADA').reduce((acc, l) => acc + l.comision, 0)
  );

  readonly liqARechazar = signal<LiquidacionResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  constructor() {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.liquidacionApi.getTodasLiquidaciones().subscribe({
      next: (liquidaciones) => this.liquidaciones.set(liquidaciones),
      error: () => this.liquidaciones.set([]),
    });
    this.tecnicosApi.getTecnicos().subscribe({
      next: (tecnicos) => this.tecnicos.set(tecnicos),
      error: () => this.tecnicos.set([]),
    });
  }

  aprobar(liq: LiquidacionResponse): void {
    this.liquidacionApi.aprobarLiquidacion(liq.id).subscribe({
      next: () => {
        this.toast.success('Conciliación Aprobada', `Comisión acreditada. El técnico ${liq.tecnicoNombre ?? ''} ha sido habilitado.`);
        this.cargarDatos();
      }
    });
  }

  abrirRechazo(liq: LiquidacionResponse): void {
    this.liqARechazar.set(liq);
  }

  confirmarRechazo(): void {
    const liq = this.liqARechazar();
    if (!liq || this.motivoCtrl.invalid) return;

    this.liquidacionApi.rechazarLiquidacion(liq.id, this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Liquidación Rechazada', 'Se notificó al técnico para que suba un comprobante válido.');
        this.liqARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargarDatos();
      }
    });
  }
}
