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
  /** La carga de OTs falló: la tarjeta debe decirlo en vez de mostrar vacío. */
  readonly otsError = signal<boolean>(false);

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
   * Estado LOCAL del tracking: activo y sin un motivo de fallo. Es lo único que
   * decide si en este momento está saliendo posición; la posición guardada en el
   * servidor (`ubicacionGuardada`) es un hecho distinto y no implica reporte.
   */
  readonly ubicacionReportando = computed(() => this.tracking.activo() && !this.tracking.motivo());
  readonly ubicacionMotivo = computed(() => this.tracking.motivo());
  /** Última posición que el servidor tiene guardada del técnico. */
  readonly ubicacionGuardada = computed(() => this.tecnico()?.ubicacionActual ?? null);
  /** Instante de esa última posición, tal como lo emite el backend. */
  readonly ultimaUbicacionEn = computed(() => this.tecnico()?.ubicacionActualizadaEn ?? null);
  /**
   * Mientras el reporte ya está vivo no se ofrece volver a activarlo; la tarjeta
   * muestra en su lugar la acción de detenerlo.
   */
  readonly puedeActivarUbicacion = computed(() => !this.ubicacionReportando());
  /** Los tres requisitos locales se cumplen. */
  readonly radarVisible = computed(
    () => this.validacionAprobada() && this.disponibilidadAprobada() && this.ubicacionReportando(),
  );

  constructor() {
    // Perfil y OTs se cargan por separado: si falla el perfil, las OTs igual
    // se piden y la tarjeta puede reflejar el error en vez de quedar muda.
    cargarTecnicoAutenticado(this.tecnicosApi, (tecnico) => this.tecnico.set(tecnico));
    this.cargarOts();
  }

  /** Carga las OTs en curso del técnico autenticado. */
  private cargarOts(): void {
    this.tecnicosApi.getMisOts().subscribe({
      next: (ots) => {
        this.otsError.set(false);
        this.misOtsEnCurso.set(
          ots.filter(o => !['FINALIZADA', 'CANCELADA'].includes(o.estado))
        );
      },
      error: () => {
        this.misOtsEnCurso.set([]);
        this.otsError.set(true);
      },
    });
  }

  /** Reintento manual pedido desde la tarjeta de servicios asignados. */
  reintentarOts(): void {
    this.otsError.set(false);
    this.cargarOts();
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

  /**
   * Arranca el reporte de ubicación desde el panel. El servicio es un singleton
   * de root y NO se detiene al navegar: el técnico quiere seguir visible en el
   * radar mientras mira ofertas o ejecuta un servicio.
   *
   * `motivo()` solo se setea de forma sincrónica cuando el navegador no soporta
   * geolocalización; la denegación del permiso llega por el watch de forma
   * asíncrona y ya la explica la tarjeta, así que no se toast-ea aquí.
   */
  activarUbicacion(): void {
    this.tracking.iniciar();
    const motivo = this.tracking.motivo();
    if (motivo) {
      this.toast.error('No se pudo activar la ubicación', motivo);
      return;
    }
    this.toast.info(
      'Ubicación activada',
      'Los clientes pueden verte en el radar mientras reportes tu posición.',
    );
  }

  /** Parada explícita pedida por el técnico desde el panel. */
  detenerUbicacion(): void {
    this.tracking.detener();
    this.toast.info(
      'Ubicación desactivada',
      'Ya no aparecerás en el radar de clientes hasta que la vuelvas a activar.',
    );
  }

  /** Fecha legible de la última posición conocida; vacío si nunca reportó. */
  formatearUltimaUbicacion(iso: string | null): string {
    if (!iso) return '';
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-CO');
  }
}
