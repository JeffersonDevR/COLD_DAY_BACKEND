import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { ToastService } from '../../core/alertas/toast.service';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { EstadoOperativo, OtResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

@Component({
  selector: 'app-panel-tecnico-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EstadoBadge, EmptyState],
  templateUrl: './panel-tecnico-page.html',
})
export class PanelTecnicoPage {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  /** Porcentaje de comisión de la plataforma (15%), alineado al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misOtsEnCurso = signal<OtResponse[]>([]);

  constructor() {
    cargarTecnicoAutenticado(this.authService, this.tecnicosApi, (tecnico) => {
      this.tecnico.set(tecnico);
      if (tecnico) {
        this.tecnicosApi.getMisOts().subscribe({
          next: (ots) => this.misOtsEnCurso.set(
            ots.filter(o => !['FINALIZADA', 'CANCELADA'].includes(o.estado))
          ),
          error: () => this.misOtsEnCurso.set([]),
        });
      }
    });
  }

  cambiarEstadoOperativo(nuevo: EstadoOperativo): void {
    const t = this.tecnico();
    if (!t) return;
    // Sin `t.id`: PUT /api/tecnicos/me/estado es owner-only y el backend
    // resuelve el técnico desde el principal, así que no se envía id.
    this.tecnicosApi.actualizarEstadoOperativo(nuevo).subscribe({
      next: () => {
        this.tecnico.set({ ...t, estadoOperativo: nuevo });
        this.toast.info('Estado Actualizado', `Ahora estás ${nuevo}`);
      },
      error: (err: Error) => {
        // El backend rechaza el cambio mientras hay una OT activa (RF-F1-05).
        this.toast.error('No se pudo cambiar el estado', err.message || 'Intenta de nuevo.');
      }
    });
  }

  irAOfertas(): void {
    void this.router.navigate(['/tecnico/ofertas']);
  }
}
