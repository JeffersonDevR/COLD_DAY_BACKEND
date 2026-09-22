import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { LiquidacionApi } from '../../liquidacion/infrastructure/liquidacion-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { EstadoLiquidacion, LiquidacionResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-liquidaciones-tecnico-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div>
        <a routerLink="/tecnico/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <i class="pi pi-arrow-left text-xs"></i> Volver al Panel Técnico
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Liquidaciones y Consignaciones
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Comisión del {{ environment.commissionRate * 100 }}% de intermediación por servicios finalizados en efectivo
        </p>
      </div>

      <!-- Resumen Financiero -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Comisión Total Pendiente ({{ environment.commissionRate * 100 }}%)</span>
          <div class="text-2xl font-black text-rose-600 mt-1">
            $ {{ deudaTotal().toLocaleString('es-CO') }} COP
          </div>
          <span class="text-[11px] text-slate-400">Exigible para habilitar radar</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Monto Cobrado al Cliente</span>
          <div class="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            $ {{ totalRecaudado().toLocaleString('es-CO') }} COP
          </div>
          <span class="text-[11px] text-emerald-600 font-semibold">Tus ingresos netos ({{ (1 - environment.commissionRate) * 100 }}%)</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span class="text-xs font-semibold text-slate-500">Estado Operativo</span>
          <div class="text-lg font-black mt-2" [class.text-rose-600]="estaBloqueado()" [class.text-emerald-600]="!estaBloqueado()">
            {{ estaBloqueado() ? 'BLOQUEADO_POR_LIQUIDACION' : 'HABILITADO' }}
          </div>
          <span class="text-[11px] text-slate-400">{{ estaBloqueado() ? 'Sube comprobante para desbloquear' : 'Al día con la empresa' }}</span>
        </div>
      </div>

      <!-- Cuenta Bancaria para Consignar -->
      <div class="p-5 rounded-3xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-wrap items-center justify-between gap-4 text-xs text-sky-900 dark:text-sky-200">
        <div class="space-y-1">
          <div class="flex items-center gap-2 font-bold text-sm">
            <i class="pi pi-building-columns text-sky-600"></i>
            Datos de Consignación Oficial COLD DAY S.A.S.
          </div>
          <p>Bancolombia Cuenta Corriente: <strong># 084-920148-12</strong> • Convenio: <strong># 78492</strong></p>
          <p>Nequi / Daviplata: <strong>310 849 2014</strong> • NIT: <strong>901.849.201-4</strong></p>
        </div>
        <button
          type="button"
          (click)="copiarDatosBanco()"
          class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 font-bold hover:bg-sky-100"
        >
          Copiar Datos Bancarios
        </button>
      </div>

      <!-- Modal / Formulario para Subir Comprobante -->
      @if (liqSeleccionada(); as liq) {
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-sky-500 shadow-xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <i class="pi pi-receipt text-sky-600"></i>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                Legalizar Liquidación {{ liq.id }} (OT: {{ liq.otId }})
              </h3>
            </div>
            <button type="button" (click)="liqSeleccionada.set(null)" class="text-slate-400 hover:text-slate-600">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs flex justify-between">
            <span>Comisión a Transferir: <strong>$ {{ liq.comision.toLocaleString('es-CO') }} COP</strong></span>
            <span>Servicio Total: $ {{ liq.montoServicio.toLocaleString('es-CO') }}</span>
          </div>

          <form [formGroup]="comprobanteForm" (ngSubmit)="enviarComprobante()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="num-referencia" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Número de Aprobación / Referencia Bancaria *
                </label>
                <input
                  id="num-referencia"
                  type="text"
                  formControlName="referencia"
                  placeholder="Ej. BCOL-8492048 o NQ-91823"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label for="comprobante-url" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  URL Comprobante o Foto de Transferencia *
                </label>
                <input
                  id="comprobante-url"
                  type="text"
                  formControlName="comprobanteUrl"
                  placeholder="https://comprobantes.com/foto-recibo.jpg"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="liqSeleccionada.set(null)"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="comprobanteForm.invalid"
                class="px-6 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors"
              >
                Enviar a Verificación Administrativa
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Lista de Liquidaciones -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Historial de Liquidaciones</h2>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider">
              <tr>
                <th class="p-3 rounded-l-xl">ID / OT</th>
                <th class="p-3">Fecha</th>
                <th class="p-3">Valor Servicio</th>
                <th class="p-3">Comisión {{ environment.commissionRate * 100 }}%</th>
                <th class="p-3">Medio Cobrado</th>
                <th class="p-3">Estado</th>
                <th class="p-3 rounded-r-xl text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (liq of misLiquidaciones(); track liq.id) {
                <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3 font-mono font-bold">
                    {{ liq.id }}
                    <span class="block text-[11px] text-slate-400">OT: {{ liq.otId }}</span>
                  </td>
                  <td class="p-3 text-slate-600 dark:text-slate-300">{{ liq.fechaCreacion | date:'shortDate' }}</td>
                  <td class="p-3 font-bold">$ {{ liq.montoServicio.toLocaleString('es-CO') }}</td>
                  <td class="p-3 font-extrabold text-rose-600">$ {{ liq.comision.toLocaleString('es-CO') }}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800">
                      {{ liq.medioPago }}
                    </span>
                  </td>
                  <td class="p-3">
                    <span
                      class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      [class.bg-rose-100]="liq.estado === 'PENDIENTE_CONSIGNACION'"
                      [class.text-rose-800]="liq.estado === 'PENDIENTE_CONSIGNACION'"
                      [class.bg-amber-100]="liq.estado === 'EN_VERIFICACION'"
                      [class.text-amber-800]="liq.estado === 'EN_VERIFICACION'"
                      [class.bg-emerald-100]="liq.estado === 'APROBADA'"
                      [class.text-emerald-800]="liq.estado === 'APROBADA'"
                      [class.bg-slate-100]="liq.estado === 'RECHAZADA'"
                      [class.text-slate-800]="liq.estado === 'RECHAZADA'"
                    >
                      {{ liq.estado }}
                    </span>
                  </td>
                  <td class="p-3 text-right">
                    @if (liq.estado === 'PENDIENTE_CONSIGNACION' || liq.estado === 'RECHAZADA') {
                      <button
                        type="button"
                        (click)="abrirSubida(liq)"
                        class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                      >
                        Subir Recibo
                      </button>
                    } @else if (liq.estado === 'EN_VERIFICACION') {
                      <span class="text-amber-600 font-semibold text-[11px]">En auditoría contable</span>
                    } @else {
                      <i class="pi pi-check-circle text-emerald-500 text-sm"></i>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class LiquidacionesTecnicoPage {
  private readonly authService = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly toast = inject(ToastService);

  /** Expuesto al template para derivar las etiquetas de comisión. */
  readonly environment = environment;

  readonly liqSeleccionada = signal<LiquidacionResponse | null>(null);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misLiquidaciones = signal<LiquidacionResponse[]>([]);

  constructor() {
    const usuarioId = Number(this.authService.currentUser()?.id ?? 0);
    this.tecnicosApi.getTecnicoPorUsuarioId(usuarioId).subscribe({
      next: (tecnico) => this.tecnico.set(tecnico),
      error: () => this.tecnico.set(undefined),
    });
    this.cargarLiquidaciones(usuarioId);
  }

  readonly estaBloqueado = computed(() =>
    this.tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION' || this.deudaTotal() > 0
  );

  private readonly estadosPendientes = new Set<EstadoLiquidacion>([
    'PENDIENTE_CONSIGNACION',
    'EN_VERIFICACION',
    'RECHAZADA',
  ]);

  readonly deudaTotal = computed(() =>
    this.misLiquidaciones()
      .filter(l => this.estadosPendientes.has(l.estado))
      .reduce((acc, l) => acc + l.comision, 0)
  );

  readonly totalRecaudado = computed(() => {
    return this.misLiquidaciones().reduce((acc, l) => acc + l.montoServicio, 0);
  });

  private cargarLiquidaciones(usuarioId: number): void {
    this.liquidacionApi.getLiquidacionesPorTecnico(String(usuarioId)).subscribe({
      next: (liquidaciones) => this.misLiquidaciones.set(liquidaciones),
      error: () => this.misLiquidaciones.set([]),
    });
  }

  readonly comprobanteForm = new FormGroup({
    referencia: new FormControl('BCOL-8492048', { nonNullable: true, validators: [Validators.required] }),
    comprobanteUrl: new FormControl('https://coldday.com.co/recibos/consignacion-bancolombia.jpg', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  abrirSubida(liq: LiquidacionResponse): void {
    this.liqSeleccionada.set(liq);
  }

  enviarComprobante(): void {
    if (this.comprobanteForm.invalid) return;
    const liq = this.liqSeleccionada();
    if (!liq) return;

    const val = this.comprobanteForm.getRawValue();
    this.liquidacionApi.subirComprobante(liq.id, val.comprobanteUrl, val.referencia).subscribe({
      next: () => {
        this.toast.success('Comprobante Registrado', 'Pasa a cola de conciliación contable de COLD DAY.');
        this.liqSeleccionada.set(null);
        this.cargarLiquidaciones(Number(this.authService.currentUser()?.id ?? 0));
      }
    });
  }

  copiarDatosBanco(): void {
    navigator.clipboard?.writeText('Bancolombia Cuenta Corriente: 084-920148-12 Convenio 78492 NIT 901849201');
    this.toast.info('Copiado', 'Datos bancarios copiados al portapapeles.');
  }
}
