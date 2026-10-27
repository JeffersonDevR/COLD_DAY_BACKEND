import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { SseService } from '../../core/service/sse.service';
import { ApiConfig } from '../../core/service/api.config';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

/**
 * Copy propia de esta pantalla: el 409 de `POST /ofertas/{id}/aceptar` es
 * concurrencia real (otro técnico tomó la orden primero). Cualquier otro
 * status usa el copy genérico del helper: no autoriza a afirmar la causa.
 */
const MENSAJES_ACEPTAR_OFERTA: Record<number, string> = {
  409: 'Esta orden ya fue tomada por otro técnico en el perímetro.',
};

@Component({
  selector: 'app-ofertas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './ofertas-page.html',
})
export class OfertasPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sse = inject(SseService, { optional: true });
  private readonly apiConfig = inject(ApiConfig, { optional: true });

  readonly loadingOt = signal<string | null>(null);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly ofertas = signal<OfertaTecnicoResponse[]>([]);

  /** Cargo de visita + diagnóstico que verá el cliente al aceptar. */
  readonly auxiliaresMax = environment.auxiliaresMax;

  /** Conteo de auxiliares por OT; 0 por defecto para aceptar sin fricción. */
  private readonly auxiliaresPorOt = signal<Record<string, number>>({});

  readonly solicitudesDisponibles = computed(() => this.ofertas().map(oferta => oferta.ot));

  /** Suscripcion SSE activa; se cierra antes de reabrir (HMR/instancias). */
  private suscripcionSse: Subscription | null = null;

  ngOnInit(): void {
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
          // El payload es informativo: cualquier evento significa "tus ofertas
          // cambiaron", asi que se avisa y se refrescan.
          this.anunciarOfertaNueva();
          this.recargarOfertas(true);
        },
        error: () => {
          /* el poll de 25s cubre la recuperación */
        },
      });
  }

  constructor() {
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        this.tecnico.set(tecnico);
        if (tecnico) {
          this.cargarOfertas(tecnico.id);
        }
      },
      (err) => avisarErrorAccion(this.toast, 'No se pudo cargar tu perfil de técnico', err),
    );
    // Refresco del radar: cada 25 s y solo con la pestaña visible. Es silencioso
    // para no repetir el aviso de error en cada vuelta.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOfertas(true));
  }

  /**
   * Anuncia la oferta nueva, que llega SOLA por el canal del técnico. Los
   * toasts verdes (`success`) son para lo que el técnico acaba de hacer, así que
   * la noticia entrante va en `info`.
   */
  private anunciarOfertaNueva(): void {
    this.toast.info('Nueva oferta', 'Hay una nueva orden de trabajo disponible cerca de ti.');
  }

  private cargarOfertas(tecnicoId: string, inicial = true): void {
    this.tecnicosApi.getOfertasParaTecnico(tecnicoId).subscribe({
      next: (ofertas) => this.ofertas.set(ofertas),
      error: (err) => {
        if (inicial) avisarErrorAccion(this.toast, 'No se pudieron cargar las ofertas', err);
      },
    });
  }

  /** `silencioso` lo usa el refresco periódico; el botón manual sí avisa del fallo. */
  recargarOfertas(silencioso = false): void {
    const tecnico = this.tecnico();
    if (tecnico) {
      this.cargarOfertas(tecnico.id, !silencioso);
    }
  }

  /** Auxiliares declarados para una OT; 0 cuando el técnico no toca el campo. */
  auxiliaresDe(otId: string): number {
    return this.auxiliaresPorOt()[otId] ?? 0;
  }

  setAuxiliares(otId: string, raw: string): void {
    const valor = raw === '' ? 0 : Number(raw);
    this.auxiliaresPorOt.update((mapa) => ({ ...mapa, [otId]: Number.isFinite(valor) ? valor : 0 }));
  }

  aceptarOferta(ot: OtResponse): void {
    const tecnico = this.tecnico();
    if (!tecnico) {
      this.toast.error('Error', 'No se encontró el perfil de técnico.');
      return;
    }

    if (tecnico.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
      this.toast.error('Operación Bloqueada', 'Debes legalizar tus liquidaciones pendientes para tomar servicios.');
      return;
    }

    const auxiliaresRequeridos = this.auxiliaresDe(ot.id);
    if (
      !Number.isInteger(auxiliaresRequeridos) ||
      auxiliaresRequeridos < 0 ||
      auxiliaresRequeridos > this.auxiliaresMax
    ) {
      this.toast.error(
        'Auxiliares inválidos',
        `Indica un número entero entre 0 y ${this.auxiliaresMax}. Usa 0 si no necesitas ayudantes.`
      );
      return;
    }

    const oferta = this.ofertas().find(o => o.otId === ot.id);
    if (!oferta) {
      this.toast.error('Sin Oferta Vigente', `No hay una oferta activa para la orden ${ot.codigo || 'Sin código'}. Puede que ya haya sido tomada.`);
      return;
    }

    this.loadingOt.set(ot.id);
    this.tecnicosApi.aceptarOferta(oferta.id, tecnico.id, auxiliaresRequeridos).subscribe({
      next: () => {
        this.loadingOt.set(null);
        const detalleAuxiliares =
          auxiliaresRequeridos > 0 ? ` con ${auxiliaresRequeridos} auxiliar(es)` : '';
        this.toast.success(
          '¡Servicio Asignado!',
          `Has tomado la orden ${ot.codigo || 'Sin código'}${detalleAuxiliares}. Se notificó al cliente la tarifa de visita + diagnóstico por distancia. Desplázate al domicilio.`
        );
        this.router.navigate(['/tecnico/ejecucion', ot.id]);
      },
      error: (err) => {
        this.loadingOt.set(null);
        // Solo un 409 prueba que otro técnico tomó la orden antes. Un 401/403/5xx
        // o un fallo de red no lo prueba, así que no se afirma esa causa (y un
        // 401 ya notificado por el interceptor no recibe un segundo aviso).
        const concurrencia = err instanceof ApiHttpError && err.status === 409;
        avisarErrorAccion(
          this.toast,
          concurrencia ? 'Error de Concurrencia' : 'No se pudo tomar la orden',
          err,
          MENSAJES_ACEPTAR_OFERTA,
        );
      }
    });
  }
}
