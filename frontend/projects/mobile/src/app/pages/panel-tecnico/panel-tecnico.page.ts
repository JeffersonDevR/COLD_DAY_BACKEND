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
import { interval } from 'rxjs';
import {
  IonButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonToggle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { categoriaLabel, estadoOperativoLabel } from '@core/ui/labels';
import {
  CategoriaServicio,
  EstadoOperativo,
  EstadoOt,
  OfertaTecnicoResponse,
  OtResponse,
  TecnicoResponse,
} from '@core/models/common.models';
import { iconoCategoria as iconoDeCategoria } from '../../core/icono-categoria';
import { MobileToastService } from '../../core/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { OrdenActivaComponent } from '../../shared/ui/orden-activa/orden-activa';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { PageComponent } from '../../shared/ui/page/page';

/**
 * The backend answers 409 on `PUT /tecnicos/me/estado` when there is an active
 * order (RF-F1-05): retrying cannot work until it is finished or cancelled.
 */
const MENSAJES_ESTADO_OPERATIVO: Record<number, string> = {
  409: 'Tienes una orden en curso. No puedes cambiar tu disponibilidad hasta finalizarla o cancelarla.',
};

/** B2 — Technician panel: availability, presence and active orders. */
@Component({
  selector: 'app-panel-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageComponent,
    IonButton,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonToggle,
    IonToolbar,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    MarcaBarraComponent,
    OrdenActivaComponent,
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

  /** Ofertas vivas del radar, previsualizadas en el panel (Stitch B0 §6).
   * Solo se pintan cuando existen: sin ofertas no hay sección ni conteo en 0. */
  readonly ofertas = signal<OfertaTecnicoResponse[]>([]);
  readonly hayPrioridadAlta = computed(() =>
    this.ofertas().some((o) => o.ot.prioridad === 'ALTA'),
  );

  /** Etiqueta canónica de la categoría: mismo vocabulario que el radar. */
  readonly categoriaLabel = categoriaLabel;

  /** Disponibilidad como chips de selección: 3 opciones fijas, sin segment. */
  readonly opcionesDisponibilidad: readonly {
    valor: EstadoOperativo;
    etiqueta: string;
    testId: string;
  }[] = [
    { valor: 'DISPONIBLE', etiqueta: 'Disponible', testId: 'disponible' },
    { valor: 'OCUPADO', etiqueta: 'Ocupado', testId: 'ocupado' },
    { valor: 'FUERA_DE_SERVICIO', etiqueta: 'Fuera', testId: 'fuera' },
  ];

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

  /** El chip de la barra de marca refleja el estado operativo real (Stitch B0). */
  readonly chipEstado = computed(() => {
    const estado = this.tecnico()?.estadoOperativo;
    return estado ? estadoOperativoLabel(estado) : '';
  });

  /** La primera de la cola: la orden en la que se trabaja ahora (§4). */
  readonly otActiva = computed(() => this.misOts()[0] ?? null);
  readonly restoOts = computed(() => this.misOts().slice(1));

  readonly modoUbicacion = computed(() => this.presencia.modo());
  /** Stitch B0: el título afirma el estado ("Compartiendo ubicación"). */
  readonly tituloUbicacion = computed(() =>
    this.presencia.modo() === 'apagada' ? 'Compartir ubicación' : 'Compartiendo ubicación',
  );
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
      (tecnico) => {
        this.tecnico.set(tecnico);
        if (tecnico) this.cargarOfertas();
      },
      (err) => avisarErrorAccion(this.toast, 'No pudimos cargar tu perfil de técnico', err),
    );
    this.cargarOts();
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cargarOts(false);
        this.cargarOfertas();
      });
    this.escucharOfertas();
    this.iniciarTickerOfertas();
  }

  /** Preview silencioso: si falla, la sección simplemente no aparece (el
   * radar conserva su propio error con reintento; acá no se inventa nada). */
  private cargarOfertas(): void {
    const tecnico = this.tecnico();
    if (!tecnico) return;
    this.tecnicosApi.getOfertasParaTecnico(tecnico.id).subscribe({
      next: (ofertas) => this.ofertas.set(ofertas),
      error: () => this.ofertas.set([]),
    });
  }

  /**
   * Ticker local del countdown (renovacion-reglas-stitch §6): el snapshot de
   * `segundosRestantes` no puede quedar congelado. Al llegar a 0 la oferta se
   * retira de la vista y se recarga la lista real del backend.
   */
  private iniciarTickerOfertas(): void {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.ofertas().length === 0) return;
        let expiradas = false;
        const vivas = this.ofertas()
          .map((o) => ({ ...o, segundosRestantes: o.segundosRestantes - 1 }))
          .filter((o) => {
            if (o.segundosRestantes > 0) return true;
            expiradas = true;
            return false;
          });
        this.ofertas.set(vivas);
        if (expiradas) this.cargarOfertas();
      });
  }

  refrescar(evento: RefresherCustomEvent): void {
    this.recargarPerfil();
    this.cargarOfertas();
    this.cargarOts(false, {
      alTerminar: () => void evento.target.complete(),
      alFallar: (err) => avisarErrorAccion(this.toast, 'No pudimos actualizar', err),
    });
  }

  /** Los avisos que bloquean salen del perfil: deslizar tiene que traerlo de nuevo. */
  private recargarPerfil(): void {
    cargarTecnicoAutenticado(this.tecnicosApi, (tecnico) => {
      // Con error llega `undefined`: se conserva el perfil que ya se ve.
      if (tecnico) this.tecnico.set(tecnico);
    });
  }

  /** Cliente y barrio, solo si el backend los entrega. */
  contextoOt(orden: OtResponse): string[] {
    return [orden.clienteNombre, orden.barrio].filter((dato): dato is string => !!dato);
  }

  private cargarOts(
    inicial = true,
    manual: { alTerminar?: () => void; alFallar?: (err: unknown) => void } = {},
  ): void {
    if (inicial) this.cargando.set(true);
    this.tecnicosApi.getMisOts().subscribe({
      next: (ots) => {
        this.otsError.set(false);
        this.cargando.set(false);
        this.misOts.set(ots.filter((o) => !['FINALIZADA', 'CANCELADA'].includes(o.estado)));
        this.presencia.sincronizarOts(ots);
        manual.alTerminar?.();
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        manual.alTerminar?.();
        // Solo avisa lo que pidió el usuario: el sondeo falla en silencio.
        manual.alFallar?.(err);
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
        next: () => {
          void this.toast.info(
            'Nueva oferta',
            'Hay una nueva orden de trabajo disponible cerca de ti.',
          );
          this.cargarOfertas();
        },
        error: () => undefined,
      });
  }

  cambiarDisponibilidad(nuevo: EstadoOperativo): void {
    const actual = this.tecnico();
    if (!actual || actual.estadoOperativo === nuevo) return;

    this.tecnicosApi.actualizarEstadoOperativo(nuevo).subscribe({
      next: () => {
        this.tecnico.set({ ...actual, estadoOperativo: nuevo });
        void this.toast.info('Estado actualizado', `Ahora estás ${estadoOperativoLabel(nuevo).toLowerCase()}.`);
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

  abrirOt(otId: string): void {
    void this.router.navigate(['/tecnico/ejecucion', otId]);
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }

  /** Mismo formato de vencimiento que el radar (B1): un solo vocabulario. */
  expira(segundos: number): string {
    const total = Math.max(0, Math.floor(segundos));
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return minutos > 0 ? `${minutos}m ${resto}s` : `${resto}s`;
  }

  /**
   * `distanciaKm` en 0 significa que el backend no expuso la distancia real:
   * en ese caso solo se afirma el radio difundido (dato del DTO), nunca "0 km".
   * Igual que en el radar.
   */
  distanciaLinea(oferta: OfertaTecnicoResponse): string {
    const radio = `radio de ${this.distancia(oferta.radioVigenteKm)}`;
    return oferta.distanciaKm > 0
      ? `A ${this.distancia(oferta.distanciaKm)} · ${radio}`
      : `Dentro de tu radio · ${radio}`;
  }

  private distancia(km: number): string {
    return `${km.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
  }

  /** Icono decorativo de categoría compartido con el radar. */
  iconoCategoria(categoria: CategoriaServicio): string {
    return iconoDeCategoria(categoria);
  }
}
