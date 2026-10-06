import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
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
    this.clientesApi.getOtsPorCliente(currentId).subscribe({
      next: (ots) => this._ots.set(ots),
      error: () => this._ots.set([]),
    });
  }

  irASolicitar(): void {
    // routerLink handles this
  }
}
