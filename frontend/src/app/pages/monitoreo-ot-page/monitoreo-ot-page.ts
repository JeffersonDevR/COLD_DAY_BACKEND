import { ChangeDetectionStrategy, Component, DestroyRef, inject, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-monitoreo-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge],
  templateUrl: './monitoreo-ot-page.html'
})
export class MonitoreoOtPage {
  private readonly adminApi = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly busquedaCtrl = new FormControl('');
  readonly filtroCategoriaCtrl = new FormControl('TODAS');
  readonly filtroEstadoCtrl = new FormControl('TODOS');

  readonly ordenes = signal<OtResponse[]>([]);

  constructor() {
    this.cargarOrdenes(true);
    // El tablero se refresca cada 25 s y solo con la pestaña visible: un fallo
    // transitorio del polling no debe vaciar la tabla en pantalla.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOrdenes(false));
  }

  /** `inicial` distingue la primera carga (que vacía si falla) del refresco periódico. */
  private cargarOrdenes(inicial: boolean): void {
    this.adminApi.getTodasOts().subscribe({
      next: (ots) => this.ordenes.set(ots),
      error: () => {
        if (inicial) this.ordenes.set([]);
      },
    });
  }

  readonly otsFiltradas = computed(() => {
    let list = this.ordenes();
    const query = this.busquedaCtrl.value?.toLowerCase().trim() || '';
    const cat = this.filtroCategoriaCtrl.value || 'TODAS';
    const est = this.filtroEstadoCtrl.value || 'TODOS';

    if (query) {
      list = list.filter(o =>
        o.codigo?.toLowerCase().includes(query) ||
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
