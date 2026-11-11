import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { EstadoOperativo, EstadoOt, OtResponse, TecnicoResponse } from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';

/**
 * The backend answers 409 on `PUT /tecnicos/me/estado` when there is an active
 * order (RF-F1-05): retrying cannot work until it is finished or cancelled.
 */
const MENSAJES_ESTADO_OPERATIVO: Record<number, string> = {
  409: 'Tenés una orden en curso. No podés cambiar tu disponibilidad hasta finalizarla o cancelarla.',
};

/** B2 — Technician panel: availability, presence and active orders. */
@Component({
  selector: 'app-panel-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonToggle,
    IonToolbar,
  ],
  templateUrl: './panel-tecnico.page.html',
})
export class PanelTecnicoPageMobile implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(MobileToastService);
  private readonly presencia = inject(TecnicoPresenciaService);
  private readonly router = inject(Router);
  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misOts = signal<OtResponse[]>([]);
  readonly otsError = signal(false);
  readonly cargando = signal(true);

  readonly validacionAprobada = computed(() => this.tecnico()?.estadoValidacion === 'APROBADO');
  readonly validacionRechazada = computed(() => {
    const estado = this.tecnico()?.estadoValidacion;
    return estado === 'RECHAZADO' || estado === 'SUSPENDIDO';
  });
  readonly disponibilidad = computed<EstadoOperativo>(
    () => this.tecnico()?.estadoOperativo ?? 'DISPONIBLE',
  );
  readonly bloqueadoPorLiquidacion = computed(
    () => this.tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION',
  );

  readonly modoUbicacion = computed(() => this.presencia.modo());
  readonly compartirUbicacion = computed(() => this.presencia.compartirUbicacion());
  readonly switchBloqueado = computed(() => this.presencia.switchBloqueado());
  readonly ubicacionReportando = computed(() => this.presencia.reportando());
  readonly ubicacionMotivo = computed(() => this.presencia.motivo());
  readonly radarVisible = computed(
    () => this.validacionAprobada() && this.disponibilidad() === 'DISPONIBLE' && this.ubicacionReportando(),
  );

  ngOnInit(): void {
    this.presencia.sincronizarOts([]);
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => this.tecnico.set(tecnico),
      (err) => avisarErrorAccion(this.toast, 'No pudimos cargar tu perfil de técnico', err),
    );
    this.cargarOts();
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOts(false));
    this.escucharOfertas();
  }

  private cargarOts(inicial = true): void {
    if (inicial) this.cargando.set(true);
    this.tecnicosApi.getMisOts().subscribe({
      next: (ots) => {
        this.otsError.set(false);
        this.cargando.set(false);
        this.misOts.set(ots.filter((o) => !['FINALIZADA', 'CANCELADA'].includes(o.estado)));
        this.presencia.sincronizarOts(ots);
      },
      error: () => {
        this.cargando.set(false);
        if (!inicial) return;
        this.misOts.set([]);
        this.otsError.set(true);
        this.presencia.sincronizarOts([]);
      },
    });
  }

  reintentarOts(): void {
    this.otsError.set(false);
    this.cargarOts();
  }

  /** New offers reach the technician even outside the radar tab. */
  private escucharOfertas(): void {
    this.sse
      .abrirOfertasTecnico()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          void this.toast.info(
            'Nueva oferta',
            'Hay una nueva orden de trabajo disponible cerca de ti.',
          ),
        error: () => undefined,
      });
  }

  cambiarDisponibilidad(nuevo: EstadoOperativo): void {
    const actual = this.tecnico();
    if (!actual || actual.estadoOperativo === nuevo) return;

    this.tecnicosApi.actualizarEstadoOperativo(nuevo).subscribe({
      next: () => {
        this.tecnico.set({ ...actual, estadoOperativo: nuevo });
        void this.toast.info('Estado actualizado', `Ahora estás ${nuevo.toLowerCase()}.`);
      },
      error: (err: Error) =>
        void avisarErrorAccion(
          this.toast,
          'No se pudo cambiar el estado',
          err,
          MENSAJES_ESTADO_OPERATIVO,
        ),
    });
  }

  alternarCompartirUbicacion(event: CustomEvent<{ checked: boolean }>): void {
    if (this.switchBloqueado()) return;

    if (event.detail.checked) {
      this.presencia.activar();
      const motivo = this.presencia.motivo();
      if (motivo) {
        void this.toast.error('No se pudo activar la ubicación', motivo);
        return;
      }
      void this.toast.info(
        'Ubicación activada',
        'Los clientes pueden verte en el radar mientras reportes tu posición.',
      );
      return;
    }

    this.presencia.desactivar();
    void this.toast.info(
      'Ubicación desactivada',
      'Ya no aparecerás en el radar de clientes hasta que la vuelvas a activar.',
    );
  }

  reintentarUbicacion(): void {
    this.presencia.reintentar();
  }

  irARadar(): void {
    void this.router.navigate(['/tecnico/radar']);
  }

  irAPerfil(): void {
    void this.router.navigate(['/tecnico/perfil']);
  }

  irALiquidaciones(): void {
    void this.router.navigate(['/tecnico/liquidaciones']);
  }

  abrirOt(otId: string): void {
    void this.router.navigate(['/tecnico/ejecucion', otId]);
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }
}
