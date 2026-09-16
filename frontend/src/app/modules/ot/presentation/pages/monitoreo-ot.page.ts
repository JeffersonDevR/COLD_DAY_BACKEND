import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ETIQUETA_ESTADO_OT,
  EstadoOt,
  ORDEN_ESTADOS_OT,
} from '../../domain/models/estado-ot.model';
import { CrearOrdenTrabajoRequest } from '../../domain/models/orden-trabajo.model';
import { OtFacadeService } from '../../application/ot-facade.service';
import { OtTablaRow } from '../components/ot-tabla-row';

const MUESTRAS: CrearOrdenTrabajoRequest[] = [
  {
    clienteId: 'CLI-20',
    clienteNombre: 'Valentina Ríos',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'Congelador no mantiene la temperatura.',
    direccion: 'Calle 11 #4-55',
    barrio: 'Centro',
  },
  {
    clienteId: 'CLI-21',
    clienteNombre: 'Óscar Beltrán',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'Aire acondicionado gotea dentro del cuarto.',
    direccion: 'Av. 5 #18-09',
    barrio: 'La Riviera',
  },
  {
    clienteId: 'CLI-22',
    clienteNombre: 'Natalia Quintero',
    categoriaServicio: 'ELECTRODOMESTICOS',
    descripcionFalla: 'Secadora no enciende.',
    direccion: 'Cra 12 #9-14',
    barrio: 'Niña Ceci',
  },
  {
    clienteId: 'CLI-23',
    clienteNombre: 'Felipe Angarita',
    categoriaServicio: 'ELECTRICIDAD',
    descripcionFalla: 'Breaker principal se dispara al conectar carga.',
    direccion: 'Calle 20 #7-80',
    barrio: 'Prados del Este',
  },
];

@Component({
  selector: 'app-monitoreo-ot',
  imports: [ReactiveFormsModule, OtTablaRow],
  template: `
    <section class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">
            Monitoreo de órdenes de trabajo
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Ciclo de vida de la OT en Fase 1 · datos simulados (mock)
          </p>
        </div>
        <button
          type="button"
          (click)="crearDemo()"
          class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus:outline-2 focus:outline-offset-2 focus:outline-sky-600"
        >
          Nueva OT (demo)
        </button>
      </header>

      @if (error(); as mensaje) {
        <div
          class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {{ mensaje }}
        </div>
      }

      <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        @for (kpi of kpis(); track kpi.etiqueta) {
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {{ kpi.etiqueta }}
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-900">{{ kpi.valor }}</p>
          </div>
        }
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          [formControl]="busquedaCtrl"
          placeholder="Buscar por OT, cliente, técnico o dirección…"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-2 focus:outline-offset-0 focus:outline-sky-500 sm:w-96"
        />
        <select
          [value]="filtroEstado()"
          (change)="cambiarFiltro($event)"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-2 focus:outline-offset-0 focus:outline-sky-500"
        >
          <option value="TODAS">Todos los estados</option>
          @for (estado of estados; track estado) {
            <option [value]="estado">{{ etiquetaEstado(estado) }}</option>
          }
        </select>
        <span class="ml-auto text-sm text-slate-500">
          {{ ordenesFiltradas().length }} de {{ total() }} órdenes
        </span>
      </div>

      <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th scope="col" class="px-4 py-3">OT</th>
                <th scope="col" class="px-4 py-3">Cliente</th>
                <th scope="col" class="px-4 py-3">Categoría</th>
                <th scope="col" class="px-4 py-3">Técnico</th>
                <th scope="col" class="px-4 py-3">Estado</th>
                <th scope="col" class="px-4 py-3 text-right">Presupuesto</th>
                <th scope="col" class="px-4 py-3 text-right">Actualizada</th>
                <th scope="col" class="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (ot of ordenesFiltradas(); track ot.id) {
                <tr appOtTablaRow [ot]="ot"></tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-4 py-12 text-center text-sm text-slate-500">
                    No hay órdenes de trabajo que coincidan con el filtro.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (cargando()) {
        <p class="mt-3 text-sm text-slate-500" role="status">Actualizando órdenes de trabajo…</p>
      }
    </section>
  `,
})
export class MonitoreoPage {
  private readonly facade = inject(OtFacadeService);
  private contador = 0;

  protected readonly busquedaCtrl = new FormControl('', { nonNullable: true });
  private readonly busqueda = toSignal(this.busquedaCtrl.valueChanges, { initialValue: '' });

  protected readonly filtroEstado = signal<EstadoOt | 'TODAS'>('TODAS');
  protected readonly estados = ORDEN_ESTADOS_OT;

  protected readonly ordenes = this.facade.ordenes;
  protected readonly cargando = this.facade.cargando;
  protected readonly error = this.facade.error;
  protected readonly total = this.facade.total;

  protected readonly kpis = computed(() => [
    { etiqueta: 'Total', valor: this.facade.total() },
    { etiqueta: 'Activas', valor: this.facade.activas() },
    { etiqueta: 'Finalizadas', valor: this.facade.finalizadas() },
    { etiqueta: 'En disputa', valor: this.facade.enDisputa() },
  ]);

  protected readonly ordenesFiltradas = computed(() => {
    const query = this.busqueda().toLocaleLowerCase().trim();
    const estado = this.filtroEstado();
    return this.ordenes().filter((ot) => {
      const coincideEstado = estado === 'TODAS' || ot.estado === estado;
      const coincideTexto =
        !query ||
        ot.id.toLocaleLowerCase().includes(query) ||
        ot.clienteNombre.toLocaleLowerCase().includes(query) ||
        (ot.tecnicoNombre ?? '').toLocaleLowerCase().includes(query) ||
        ot.direccion.toLocaleLowerCase().includes(query);
      return coincideEstado && coincideTexto;
    });
  });

  constructor() {
    this.facade.cargar();
  }

  protected etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  protected cambiarFiltro(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as EstadoOt | 'TODAS';
    this.filtroEstado.set(valor);
  }

  protected crearDemo(): void {
    const muestra = MUESTRAS[this.contador++ % MUESTRAS.length];
    this.facade.crear({ ...muestra });
  }
}
