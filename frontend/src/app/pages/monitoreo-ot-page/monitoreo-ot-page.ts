import { ChangeDetectionStrategy, Component, DestroyRef, inject, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { CargaError } from '../../shared/carga-error/carga-error';
import { OtResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-monitoreo-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge, CargaError],
  templateUrl: './monitoreo-ot-page.html'
})
export class MonitoreoOtPage {
  private readonly adminApi = inject(AdminApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly busquedaCtrl = new FormControl('');
  readonly filtroCategoriaCtrl = new FormControl('TODAS');
  readonly filtroEstadoCtrl = new FormControl('TODOS');

  readonly ordenes = signal<OtResponse[]>([]);
  /** Carga silenciosa: el primer fallo se ve y se puede reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  constructor() {
    this.cargarOrdenes(true);
    // El tablero se refresca cada 25 s y solo con la pestaña visible: un fallo
    // transitorio del polling no debe vaciar la tabla en pantalla.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOrdenes(false));
  }

  /** Reintento manual desde el aviso de error. */
  reintentar(): void {
    this.cargarOrdenes(true);
  }

  /** `inicial` distingue la primera carga (que vacía si falla) del refresco periódico. */
  private cargarOrdenes(inicial: boolean): void {
    if (inicial) {
      this.cargando.set(true);
      this.errorCarga.set(false);
    }
    this.adminApi.getTodasOts().subscribe({
      next: (ots) => {
        this.ordenes.set(ots);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        if (inicial) {
          this.ordenes.set([]);
          this.errorCarga.set(true);
        }
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
