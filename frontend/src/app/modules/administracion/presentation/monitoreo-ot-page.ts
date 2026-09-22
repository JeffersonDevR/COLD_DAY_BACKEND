import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApi } from '../infrastructure/admin-api';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-monitoreo-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge],
  template: `
    <div class="space-y-6 max-w-7xl mx-auto">
      <div>
        <a routerLink="/admin/dashboard" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <i class="pi pi-arrow-left text-xs"></i> Volver a la Torre de Control
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Monitoreo Global de Órdenes de Trabajo
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Visibilidad perimetral de servicios técnicos en Cúcuta, Los Patios y Villa del Rosario
        </p>
      </div>

      <!-- Barra de Filtros -->
      <div class="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div class="flex-1 min-w-[200px]">
          <input
            type="text"
            [formControl]="busquedaCtrl"
            placeholder="Buscar por ID de OT, cliente, técnico o barrio..."
            class="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <select
            [formControl]="filtroCategoriaCtrl"
            class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="TODAS">Todas las Especialidades</option>
            <option value="AIRE_ACONDICIONADO">Aire Acondicionado</option>
            <option value="REFRIGERACION">Refrigeración</option>
            <option value="ELECTRICIDAD">Electricidad</option>
            <option value="ELECTRODOMESTICOS">Electrodomésticos</option>
          </select>
        </div>

        <div>
          <select
            [formControl]="filtroEstadoCtrl"
            class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="SOLICITADA">SOLICITADA</option>
            <option value="BUSCANDO_TECNICO">BUSCANDO_TECNICO</option>
            <option value="ASIGNADA">ASIGNADA</option>
            <option value="EN_CAMINO">EN_CAMINO</option>
            <option value="EN_DIAGNOSTICO">EN_DIAGNOSTICO</option>
            <option value="EN_REPARACION">EN_REPARACION</option>
            <option value="FINALIZADA">FINALIZADA</option>
            <option value="DISPUTADA">DISPUTADA</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>
        </div>
      </div>

      <!-- Tabla de Monitoreo -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Órdenes Activas e Históricas</h2>
          <span class="text-xs text-slate-400">{{ otsFiltradas().length }} resultados encontrados</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider">
              <tr>
                <th class="p-3 rounded-l-xl">OT</th>
                <th class="p-3">Categoría</th>
                <th class="p-3">Cliente</th>
                <th class="p-3">Técnico</th>
                <th class="p-3">Ubicación Cúcuta</th>
                <th class="p-3">Estado</th>
                <th class="p-3">Presupuesto</th>
                <th class="p-3 rounded-r-xl text-right">Ver</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (ot of otsFiltradas(); track ot.id) {
                <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3 font-mono font-bold">{{ ot.id }}</td>
                  <td class="p-3 font-semibold">{{ ot.categoriaServicio.replace('_', ' ') }}</td>
                  <td class="p-3">{{ ot.clienteNombre }}</td>
                  <td class="p-3 font-semibold text-slate-800 dark:text-slate-200">
                    {{ ot.tecnicoNombre || 'Buscando...' }}
                  </td>
                  <td class="p-3 text-slate-500">{{ ot.barrio || ot.direccion }}</td>
                  <td class="p-3">
                    <app-estado-badge [estado]="ot.estado" />
                  </td>
                  <td class="p-3 font-bold">
                    $ {{ (ot.presupuesto?.total || 0).toLocaleString('es-CO') }}
                  </td>
                  <td class="p-3 text-right">
                    <a
                      [routerLink]="['/cliente/ot', ot.id]"
                      class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1"
                    >
                      <i class="pi pi-eye text-xs" style="font-size:14px; width:14px; height:14px;"></i>
                      Detalle
                    </a>
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
export class MonitoreoOtPage {
  private readonly adminApi = inject(AdminApi);

  readonly busquedaCtrl = new FormControl('');
  readonly filtroCategoriaCtrl = new FormControl('TODAS');
  readonly filtroEstadoCtrl = new FormControl('TODOS');

  readonly ordenes = signal<OtResponse[]>([]);

  constructor() {
    this.adminApi.getTodasOts().subscribe({
      next: (ots) => this.ordenes.set(ots),
      error: () => this.ordenes.set([]),
    });
  }

  readonly otsFiltradas = computed(() => {
    let list = this.ordenes();
    const query = this.busquedaCtrl.value?.toLowerCase().trim() || '';
    const cat = this.filtroCategoriaCtrl.value || 'TODAS';
    const est = this.filtroEstadoCtrl.value || 'TODOS';

    if (query) {
      list = list.filter(o =>
        o.id.toLowerCase().includes(query) ||
        o.clienteNombre?.toLowerCase().includes(query) ||
        o.tecnicoNombre?.toLowerCase().includes(query) ||
        o.barrio?.toLowerCase().includes(query) ||
        o.direccion?.toLowerCase().includes(query)
      );
    }

    if (cat !== 'TODAS') {
      list = list.filter(o => o.categoriaServicio === cat);
    }

    if (est !== 'TODOS') {
      list = list.filter(o => o.estado === est);
    }

    return list;
  });
}
