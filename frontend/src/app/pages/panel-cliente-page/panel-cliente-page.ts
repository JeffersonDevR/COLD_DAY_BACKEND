import { ChangeDetectionStrategy, Component, DestroyRef, inject, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { OtResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-panel-cliente-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, EstadoBadge, EmptyState],
  templateUrl: './panel-cliente-page.html'
})
export class PanelClientePage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);

  private readonly _ots = signal<OtResponse[]>([]);
  readonly serviciosCliente = computed(() => this._ots());

  readonly serviciosActivos = computed(() => {
    return this.serviciosCliente().filter(o =>
      !['FINALIZADA', 'CANCELADA'].includes(o.estado)
    );
  });

  readonly serviciosFinalizados = computed(() => {
    return this.serviciosCliente().filter(o => o.estado === 'FINALIZADA');
  });

  constructor() {
    const currentId = String(this.authService.currentUser()?.id ?? '');
    this.cargarOts(currentId, true);
    // Refresco del listado: cada 25 s y solo con la pestaña visible.
    // `takeUntilDestroyed` corta el intervalo al destruirse la página.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOts(currentId, false));
  }

  /**
   * `inicial` separa la carga de arranque del refresco periódico: si el primer
   * pedido falla conviene mostrar la lista vacía, pero un fallo transitorio del
   * refresco no debe borrar lo que el cliente ya está viendo.
   */
  private cargarOts(currentId: string, inicial: boolean): void {
    this.clientesApi.getOtsPorCliente(currentId).subscribe({
      next: (ots) => this._ots.set(ots),
      error: () => {
        if (inicial) this._ots.set([]);
      },
    });
  }

  irASolicitar(): void {
    // routerLink handles this
  }
}
