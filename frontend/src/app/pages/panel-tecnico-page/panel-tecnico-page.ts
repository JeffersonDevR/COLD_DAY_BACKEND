import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
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
  private readonly router = inject(Router);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);
  private readonly tracking = inject(TecnicoTrackingService);

  /** Porcentaje de comisión de la plataforma (15%), alineado al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misOtsEnCurso = signal<OtResponse[]>([]);

  /** El técnico no aparece en el radar de clientes si una cuenta no está aprobada. */
  readonly validacionAprobada = computed(() => this.tecnico()?.estadoValidacion === 'APROBADO');
  /** Rechazo o suspensión: la cuenta quedó inhabilitada y conviene mostrar el motivo. */
  readonly validacionRechazada = computed(() => {
    const estado = this.tecnico()?.estadoValidacion;
    return estado === 'RECHAZADO' || estado === 'SUSPENDIDO';
  });
  /** El radar solo lista técnicos DISPONIBLE; OCUPADO también queda excluido. */
  readonly disponibilidadAprobada = computed(() => this.tecnico()?.estadoOperativo === 'DISPONIBLE');
  /**
   * El front no conoce la ubicación guardada en el servidor, así que solo puede
   * reportar el estado LOCAL del tracking: activo y sin un motivo de fallo.
   */
  readonly ubicacionReportando = computed(() => this.tracking.activo() && !this.tracking.motivo());
  readonly ubicacionMotivo = computed(() => this.tracking.motivo());
  /** Los tres requisitos locales se cumplen. */
  readonly radarVisible = computed(
    () => this.validacionAprobada() && this.disponibilidadAprobada() && this.ubicacionReportando(),
  );

  constructor() {
    cargarTecnicoAutenticado(this.tecnicosApi, (tecnico) => {
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
