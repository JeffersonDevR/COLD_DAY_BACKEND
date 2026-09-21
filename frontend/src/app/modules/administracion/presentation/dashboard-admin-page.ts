import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminApi } from '../infrastructure/admin-api';
import { CategoriaServicio, MetricasAdminResponse } from '../../../core/shared/domain/models/common.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-dashboard-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="space-y-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Torre de Control Administrativa
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Monitoreo en tiempo real de operaciones, conciliación y mediación • COLD DAY S.A.S.
          </p>
        </div>

        <!-- Accesos directos administrativos -->
        <div class="flex flex-wrap items-center gap-2">
          <a
            routerLink="/admin/consignaciones"
            class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <mat-icon class="text-sm">receipt_long</mat-icon>
            Conciliar Consignaciones
          </a>
          <a
            routerLink="/admin/validacion-tecnicos"
            class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <mat-icon class="text-sm">verified_user</mat-icon>
            Auditoría de Técnicos
          </a>
          <a
            routerLink="/admin/disputas"
            class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <mat-icon class="text-sm">gavel</mat-icon>
            Bandeja Disputas
          </a>
        </div>
      </div>

      <!-- 6 KPIs Principales -->
      @if (metricas(); as m) {
        <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Ejecución</span>
            <div class="text-2xl font-black text-sky-600 mt-1">{{ m.serviciosEnEjecucion }}</div>
            <span class="text-[11px] text-slate-500">OTs activas</span>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Técnicos Verif.</span>
            <div class="text-2xl font-black text-emerald-600 mt-1">{{ m.tecnicosVerificados }}</div>
            <span class="text-[11px] text-slate-500">{{ m.tecnicosDisponibles }} disponibles</span>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tiempo Resp.</span>
            <div class="text-2xl font-black text-indigo-600 mt-1">{{ m.tiempoPromedioRespuestaMin }} min</div>
            <span class="text-[11px] text-slate-500">Broadcast radar</span>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Disputas</span>
            <div class="text-2xl font-black text-rose-600 mt-1">{{ m.incidenciasActivas }}</div>
            <span class="text-[11px] text-slate-500">Pendientes</span>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recaudo Mes</span>
            <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
              $ {{ (m.totalRecaudoMesCop / 1000000).toFixed(1) }}M
            </div>
            <span class="text-[11px] text-slate-500">Total transado</span>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comisión {{ comisionPorcentaje }}%</span>
            <div class="text-lg sm:text-xl font-black text-emerald-600 mt-1">
              $ {{ (m.comisionesMesCop / 1000).toFixed(0) }}K
            </div>
            <span class="text-[11px] text-slate-500">Ingresos brutos</span>
          </div>
        </div>

        <!-- Gráficos SVG Nativos y Analítica -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Gráfico 1: Servicios Semanales (Barras SVG) -->
          <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Volumen Semanal de Servicios Técnicos
                </h3>
                <span class="text-xs text-slate-400">Comportamiento de OTs completadas en Cúcuta</span>
              </div>
              <div class="flex items-center gap-3 text-xs">
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-sky-500"></span> Completadas</span>
                <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-rose-400"></span> Canceladas</span>
              </div>
            </div>

            <!-- Gráfico de barras SVG -->
            <div class="h-56 w-full pt-4">
              <svg class="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
                <!-- Grid Lines -->
                <line x1="30" y1="20" x2="490" y2="20" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
                <line x1="30" y1="70" x2="490" y2="70" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
                <line x1="30" y1="120" x2="490" y2="120" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
                <line x1="30" y1="160" x2="490" y2="160" stroke="currentColor" stroke-opacity="0.2" />

                <!-- Eje Y labels -->
                <text x="5" y="24" class="text-[10px] fill-slate-400 font-mono">20</text>
                <text x="5" y="74" class="text-[10px] fill-slate-400 font-mono">10</text>
                <text x="12" y="124" class="text-[10px] fill-slate-400 font-mono">5</text>
                <text x="12" y="164" class="text-[10px] fill-slate-400 font-mono">0</text>

                <!-- Barras de días -->
                @for (h of m.historicoSemanal; track h.dia; let i = $index) {
                  @let xBase = 50 + i * 62;
                  @let barHeight = (h.completadas / 20) * 140;
                  @let cancHeight = (h.canceladas / 20) * 140;

                  <!-- Barra Completadas -->
                  <rect
                    [attr.x]="xBase"
                    [attr.y]="160 - barHeight"
                    width="22"
                    [attr.height]="barHeight"
                    rx="4"
                    class="fill-sky-500 hover:fill-sky-600 transition-colors"
                  />

                  <!-- Barra Canceladas -->
                  <rect
                    [attr.x]="xBase + 24"
                    [attr.y]="160 - cancHeight"
                    width="12"
                    [attr.height]="cancHeight"
                    rx="3"
                    class="fill-rose-400"
                  />

                  <!-- Etiqueta Día -->
                  <text
                    [attr.x]="xBase + 12"
                    y="176"
                    text-anchor="middle"
                    class="text-[10px] font-bold fill-slate-500"
                  >
                    {{ h.dia }}
                  </text>
                }
              </svg>
            </div>
          </div>

          <!-- Gráfico 2: Distribución por Categoría (Dona SVG) -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Distribución por Especialidad
              </h3>
              <span class="text-xs text-slate-400">Demanda en Norte de Santander</span>
            </div>

            <!-- Gráfico circular SVG Donut -->
            <div class="flex flex-col items-center justify-center py-2">
              <div class="relative w-40 h-40">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <!-- Fondo gris -->
                  <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-opacity="0.1" stroke-width="14" />

                  @for (seg of distribucion(); track seg.categoria) {
                    <circle
                      cx="50" cy="50" r="38"
                      fill="none"
                      [attr.stroke]="seg.color"
                      stroke-width="14"
                      [attr.stroke-dasharray]="seg.dasharray"
                      [attr.stroke-dashoffset]="seg.dashoffset"
                    />
                  }
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span class="text-lg font-black text-slate-900 dark:text-slate-100">{{ totalServicios() }}</span>
                  <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400">Servicios</span>
                </div>
              </div>

              <!-- Leyenda -->
              <div class="w-full mt-4 space-y-1.5 text-xs">
                @for (seg of distribucion(); track seg.categoria) {
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full" [style.background-color]="seg.color"></span>
                      {{ seg.label }}
                    </span>
                    <span class="font-bold">{{ seg.porcentaje }}%</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Acceso a Monitoreo en Vivo de OTs -->
      <div class="pt-2 flex justify-end">
        <a
          routerLink="/admin/monitoreo"
          class="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <mat-icon class="text-sm">visibility</mat-icon>
          Ver Todas las Órdenes en Monitoreo Global
        </a>
      </div>
    </div>
  `
})
export class DashboardAdminPage implements OnInit {
  private readonly adminApi = inject(AdminApi);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);
  readonly metricas = signal<MetricasAdminResponse | null>(null);

  private readonly coloresCategoria: Record<CategoriaServicio, string> = {
    AIRE_ACONDICIONADO: '#0284c7',
    REFRIGERACION: '#06b6d4',
    ELECTRICIDAD: '#f59e0b',
    ELECTRODOMESTICOS: '#10b981',
  };

  /** Segmentos de la dona calculados a partir de la distribución real. */
  readonly distribucion = computed(() => {
    const metricas = this.metricas();
    if (!metricas) {
      return [];
    }
    const perimetro = 2 * Math.PI * 38;
    let acumulado = 0;
    return metricas.distribucionCategorias.map((d) => {
      const largo = (d.porcentaje / 100) * perimetro;
      const segmento = {
        categoria: d.categoria,
        porcentaje: d.porcentaje,
        color: this.coloresCategoria[d.categoria] ?? '#64748b',
        label: d.categoria.replace('_', ' '),
        dasharray: `${largo} ${perimetro}`,
        dashoffset: `${-acumulado}`,
      };
      acumulado += largo;
      return segmento;
    });
  });

  readonly totalServicios = computed(() =>
    (this.metricas()?.distribucionCategorias ?? []).reduce((total, d) => total + d.cantidad, 0)
  );

  ngOnInit(): void {
    this.adminApi.getMetricas().subscribe({
      next: (data) => this.metricas.set(data)
    });
  }
}
