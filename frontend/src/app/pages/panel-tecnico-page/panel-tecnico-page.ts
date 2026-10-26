import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { SseService } from '../../core/service/sse.service';
import { ApiConfig } from '../../core/service/api.config';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { ToastService } from '../../core/alertas/toast.service';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { EstadoOperativo, OtResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';
import { mensajeErrorAccion } from '../../core/alertas/mensaje-error';

/**
 * Copy propia: el 409 de `PUT /tecnicos/me/estado` es la guarda de OT activa
 * (RF-F1-05). Reintentar no sirve hasta terminar o cancelar la orden.
 */
const MENSAJES_ESTADO_OPERATIVO: Record<number, string> = {
  409: 'Tenés una orden en curso. No podés cambiar tu disponibilidad hasta finalizarla o cancelarla.',
};

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
  private readonly destroyRef = inject(DestroyRef);
  private readonly sse = inject(SseService, { optional: true });
  private readonly apiConfig = inject(ApiConfig, { optional: true });

  /** Porcentaje de comisión de la plataforma (15%), alineado al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misOtsEnCurso = signal<OtResponse[]>([]);
  /** La carga de OTs falló: la tarjeta debe decirlo en vez de mostrar vacío. */
  readonly otsError = signal<boolean>(false);

  /** Suscripcion SSE activa; se cierra antes de reabrir (HMR/instancias). */
  private suscripcionSse: Subscription | null = null;

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
    // Refresco de las OTs en curso: cada 25 s y solo con la pestaña visible.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOts(false));
    this.escucharOfertasNuevas();
  }

  /**
   * Canal de ofertas del técnico: la orden nueva le llega aunque NO esté en la
   * página de ofertas (antes solo lo veía el poll de esa pantalla). Es el mismo
   * canal que ya usa `ofertas-page`: sin transporte nuevo.
   */
  private escucharOfertasNuevas(): void {
    // Fuera de mock/SSR no hay stream que abrir: el poll de respaldo queda como
    // unico mecanismo de refresco.
    if (this.sse == null || (this.apiConfig?.useMocks() ?? false) || typeof EventSource === 'undefined') {
      return;
    }
    // Cierre el stream previo si ya habia uno (HMR / multiples instancias).
    this.suscripcionSse?.unsubscribe();
    this.suscripcionSse = this.sse
      .abrirOfertasTecnico()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // El payload es informativo: cualquier evento significa "tienes una
          // orden nueva cerca". Los toasts verdes (`success`) son para lo que el
          // técnico acaba de hacer, así que la noticia entrante va en `info`.
          this.toast.info('Nueva oferta', 'Hay una nueva orden de trabajo disponible cerca de ti.');
        },
        error: () => {
          /* el poll de 25s cubre la recuperación */
        },
      });
  }

  /**
   * Carga las OTs en curso del técnico autenticado.
   *
   * `inicial` distingue la carga de arranque (y el reintento manual, que sí
   * reporta el error en la tarjeta) del refresco periódico: un fallo
   * transitorio del polling no debe tapar la lista que el técnico ya ve.
   */
  private cargarOts(inicial = true): void {
    this.tecnicosApi.getMisOts().subscribe({
      next: (ots) => {
        this.otsError.set(false);
        this.misOtsEnCurso.set(
          ots.filter(o => !['FINALIZADA', 'CANCELADA'].includes(o.estado))
        );
      },
      error: () => {
        if (!inicial) return;
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
        // Esa causa es conocida: el copy la nombra en vez del genérico de 409.
        this.toast.error('No se pudo cambiar el estado', mensajeErrorAccion(err, MENSAJES_ESTADO_OPERATIVO));
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
