import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ETIQUETA_CATEGORIA, OrdenTrabajo } from '../../domain/models/orden-trabajo.model';
import { EstadoOtBadge } from './estado-ot-badge';

@Component({
  selector: 'tr[appOtTablaRow]',
  imports: [RouterLink, CurrencyPipe, DatePipe, EstadoOtBadge],
  host: {
    class: 'border-b border-slate-100 transition-colors last:border-0 hover:bg-sky-50/70',
  },
  template: `
    <td class="px-4 py-3 text-sm font-semibold text-slate-900">{{ ot().id }}</td>
    <td class="px-4 py-3 text-sm">
      <div class="font-medium text-slate-900">{{ ot().clienteNombre }}</div>
      <div class="text-xs text-slate-500">
        {{ ot().direccion }}
        @if (ot().barrio) {
          · {{ ot().barrio }}
        }
      </div>
    </td>
    <td class="px-4 py-3 text-sm text-slate-600">{{ etiquetaCategoria() }}</td>
    <td class="px-4 py-3 text-sm text-slate-600">{{ ot().tecnicoNombre ?? 'Sin asignar' }}</td>
    <td class="px-4 py-3">
      <app-estado-ot-badge [estado]="ot().estado" />
    </td>
    <td class="px-4 py-3 text-right text-sm text-slate-700">
      @if (ot().presupuesto; as presupuesto) {
        {{ presupuesto.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
      } @else {
        <span class="text-slate-400">—</span>
      }
    </td>
    <td class="px-4 py-3 text-right text-xs text-slate-500">
      {{ ot().actualizadaEn | date: 'dd/MM/yy HH:mm' }}
    </td>
    <td class="px-4 py-3 text-right">
      <a
        [routerLink]="['/ot', ot().id]"
        class="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        Ver detalle
      </a>
    </td>
  `,
})
export class OtTablaRow {
  readonly ot = input.required<OrdenTrabajo>();

  protected readonly etiquetaCategoria = computed(
    () => ETIQUETA_CATEGORIA[this.ot().categoriaServicio],
  );
}
