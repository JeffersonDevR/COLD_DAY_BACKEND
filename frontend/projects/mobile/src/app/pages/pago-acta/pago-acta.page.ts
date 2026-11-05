import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { COMISION_PLATAFORMA_RATE } from '@core/environment/comision-plataforma';
import { ApiConfig } from '@core/service/api.config';
import { MockDbService } from '@core/service/mock-db.service';
import { OtApi } from '@core/service/ot-api';
import { cargarOtDesdeRuta, otDesdeFuente, CargaOtEstado } from '@core/service/ot-carga';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { SseService } from '@core/service/sse.service';
import {
  ActaGarantia,
  EstadoOt,
  OtResponse,
  TarifaEstimadaResponse,
} from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';

/**
 * The acta registration conflict (409) is a lifecycle clash — the OT is not
 * FINALIZADA or the acta was already signed; retrying does not help. The 400
 * is an unreadable signature; the 403 is someone else's OT. Each gets copy
 * that says what to do, never the raw backend message.
 */
const MENSAJES_ACTA: Record<number, string> = {
  409: 'El acta ya quedó registrada o la orden no está finalizada todavía. Actualizá la pantalla para ver el estado actual.',
  400: 'La firma no es válida: volvé a dibujarla y registrá el acta de nuevo.',
  403: 'Esta orden no te pertenece, así que no podés firmar su acta.',
};

/**
 * A8 — Payment and warranty acta (client).
 *
 * Replicates the web contract (pago-acta-page) with deliberate differences:
 *
 * - The payment-method selector is GONE: no endpoint ever received it, so
 *   mobile does not render a control that pretends to record a payment. The
 *   screen's only write action is registering the warranty acta.
 * - The visit tariff is NOT queried here (same as A7): the row shows
 *   "Por confirmar" and the total keeps the web formula,
 *   (presupuesto.total || 0) + (estimacion?.tarifa ?? 0), so the apps do not
 *   diverge if the estimate is ever published.
 * - The CTA is disabled while the OT is not FINALIZADA and a banner says
 *   why; the server still enforces the rule (FINALIZADA or 409). The web
 *   kept the button enabled and let the 409 teach the user; mobile prefers
 *   the honest upfront explanation.
 * - The button reads "Registrar acta de garantía": nothing is downloaded,
 *   so nothing pretends to be.
 *
 * Everything else is replicated: load with banner + Retry, SSE with a 25 s
 * poll fallback, read-only amounts with es-CO formatting, the commission
 * split, the legal clause verbatim from the web, and a success that only
 * shows the server's verification code.
 */
@Component({
  selector: 'app-pago-acta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
  ],
  templateUrl: './pago-acta.page.html',
})
export class PagoActaPage implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly otApi = inject(OtApi);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly sse = inject(SseService);
  private readonly toast = inject(MobileToastService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('signatureCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** Load state: the failure is ALWAYS visible (with Retry). */
  private cargaOtEstado: CargaOtEstado | null = null;

  /** In mock mode reads the MockDb; against the backend uses the API-loaded OT. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  /**
   * Visit-tariff estimate. This screen NEVER queries it (see the header):
   * it stays `null` and the row shows "Por confirmar". The signal and the
   * total formula are kept identical to the web contract.
   */
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  /** Repair budget + estimated visit tariff (web contract). */
  readonly totalMonto = computed<number>(
    () => (this.ot()?.presupuesto?.total || 0) + (this.estimacion()?.tarifa ?? 0),
  );

  readonly visitaPagada = computed<boolean>(() => this.ot()?.visitaPagada === true);

  readonly visitaPendienteDePago = computed<boolean>(() => {
    const orden = this.ot();
    return orden?.estado === 'ASIGNADA' && orden.visitaPagada === false;
  });

  /** As the mapper always sets both, keep the A7 order: manoObra wins. */
  readonly manoObra = computed<number | null>(() => {
    const presupuesto = this.ot()?.presupuesto;
    return presupuesto ? (presupuesto.manoObra ?? presupuesto.manoDeObra ?? 0) : null;
  });

  readonly visitaLabel = computed<string>(() => {
    const tarifa = this.estimacion()?.tarifa;
    return tarifa == null ? 'Por confirmar' : this.formatoMoneda(tarifa);
  });

  readonly manoObraLabel = computed<string>(() => {
    const valor = this.manoObra();
    return valor === null ? 'Por confirmar' : this.formatoMoneda(valor);
  });

  readonly repuestosLabel = computed<string>(() => {
    const presupuesto = this.ot()?.presupuesto;
    return presupuesto ? this.formatoMoneda(presupuesto.repuestos) : 'Por confirmar';
  });

  /** The acta is only registerable once the technician finalized the job. */
  readonly esFinalizada = computed<boolean>(() => this.ot()?.estado === 'FINALIZADA');

  /** Fallback poll when SSE gives up; `null` while the stream is alive. */
  private suscripcionRespaldo: Subscription | null = null;

  readonly hasFirma = signal<boolean>(false);

  /**
   * Acta already registered, exactly as the server returned it. While it is
   * `null` there is NO acta: the screen never invents a verification code.
   */
  readonly acta = signal<ActaGarantia | null>(null);

  /** Request in flight: disables the CTA and blocks double submission. */
  readonly guardando = signal<boolean>(false);

  private isDrawing = false;
  private ctx: CanvasRenderingContext2D | null = null;

  /** Header back: returns to the OT (or the panel if no id yet). */
  readonly backHref = computed(() =>
    this.otId() ? `/cliente/ot/${this.otId()}` : '/cliente/panel',
  );

  /** Commission split, same math as the web (rate 0.15). Not rounded: the web displays the raw product. */
  readonly comisionMonto = computed<number>(() =>
    this.totalMonto() * COMISION_PLATAFORMA_RATE,
  );

  readonly liquidoTecnicoMonto = computed<number>(() =>
    this.totalMonto() * (1 - COMISION_PLATAFORMA_RATE),
  );

  readonly comisionPorcentaje = Math.round(COMISION_PLATAFORMA_RATE * 100);
  readonly liquidoPorcentaje = 100 - this.comisionPorcentaje;

  readonly categoriaLabel = computed<string>(
    () => this.ot()?.categoriaServicio.replace('_', ' ') ?? '',
  );

  ngOnInit(): void {
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.escucharCambiosDeEstado(id);
      },
      (orden) => this._otRemoto.set(orden),
    );
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.strokeStyle = '#22d3ee';
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
    }
  }

  /** Copy of the load failure; null while there is no failure. */
  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  /** `true` while there is no OT nor error to show (initial load running). */
  cargandoInicial(): boolean {
    return !this.ot() && !this.otErrorCarga();
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => this._otRemoto.set(orden),
      // Silent reload (SSE or fallback): keep what the screen shows.
      error: () => undefined,
    });
  }

  /**
   * Live update: reload the OT when the backend pushes a change for the
   * same order. Silent by design; if the stream gives up, the fallback poll
   * takes over.
   */
  private escucharCambiosDeEstado(id: string): void {
    this.sse
      .abrirOtStream(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          if (payload.otId !== this.otId()) return;
          this.recargarOt();
        },
        error: () => this.iniciarPollDeRespaldo(),
      });
  }

  /** Stream plan B: refresh the OT every 25 s (visible tab only). */
  private iniciarPollDeRespaldo(): void {
    if (this.suscripcionRespaldo) return;
    this.suscripcionRespaldo = pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOt());
  }

  formatoMoneda(valor: number): string {
    return `$ ${valor.toLocaleString('es-CO')}`;
  }

  formatoTotal(valor: number): string {
    return `$ ${valor.toLocaleString('es-CO')} COP`;
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): 'ok' | 'curso' | 'espera' | 'cerrada' {
    return tonoEstadoOt(estado);
  }

  /** Bottom CTA: back to the OT tracking screen. */
  volver(): void {
    if (!this.otId()) return;
    void this.router.navigate(['/cliente/ot', this.otId()]);
  }

  // --- Signature canvas (Pointer Events) -----------------------------------

  startDrawing(e: PointerEvent): void {
    if (!this.ctx || !this.canvasRef) return;
    this.isDrawing = true;
    const { x, y } = this.posicionEnCanvas(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(e: PointerEvent): void {
    if (!this.isDrawing || !this.ctx || !this.canvasRef) return;
    const { x, y } = this.posicionEnCanvas(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.hasFirma.set(true);
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  /**
   * Maps client coordinates into the canvas backing store. The canvas is
   * stretched by CSS (width: 100%), so without this scale the stroke would
   * drift away from the finger on any screen narrower than 480 px. Falls
   * back to 1:1 when layout is unavailable (e.g. jsdom).
   */
  private posicionEnCanvas(e: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  limpiarFirma(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!this.ctx || !canvas) return;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasFirma.set(false);
  }

  // --- Acta registration ----------------------------------------------------

  /**
   * Persist the signed warranty acta.
   *
   * Success is only possible when the server answered 2xx with the code it
   * issued; anything else is reported as failure. The button is disabled
   * while the request is in flight because the acta is signed ONCE: a
   * double submission would be a 409 and would tell the client their
   * document failed when the real cause was a double tap.
   */
  registrarActa(): void {
    if (this.guardando() || this.acta() || !this.hasFirma() || !this.esFinalizada()) {
      return;
    }

    const firmaDataUrl = this.exportarFirma();
    if (!firmaDataUrl) {
      this.toast.error(
        'No pudimos registrar tu acta',
        'Volvé a dibujar tu firma e intentá de nuevo.',
      );
      return;
    }

    this.guardando.set(true);
    // finalize (not complete): the request failed or succeeded, the CTA must
    // always be usable again. The web resets in complete and stays disabled
    // forever after an error.
    this.otApi
      .firmarActaGarantia(this.otId(), firmaDataUrl)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (acta) => {
          // A 2xx without a code proves nothing: the code is what makes the
          // acta verifiable. Missing, it is reported as failure.
          if (!acta?.codigoVerificacion) {
            this.toast.error(
              'No pudimos registrar tu acta',
              'El servidor respondió sin un código de verificación, así que no hay acta que mostrar.',
            );
            return;
          }
          this.acta.set(acta);
          this.toast.success(
            'Acta registrada',
            `Firma y acta guardadas. Tu código de verificación es ${acta.codigoVerificacion}.`,
          );
        },
        error: (err: unknown) => {
          // Failure keeps the drawn signature: the user does not lose their
          // stroke because the server rejected the acta.
          avisarErrorAccion(this.toast, 'No pudimos registrar tu acta', err, MENSAJES_ACTA);
        },
      });
  }

  /**
   * Exports the canvas stroke as a data URL. `toDataURL` on an empty canvas
   * still returns a string (a blank PNG); an empty string means the element
   * is unavailable. Over a tainted canvas it throws SecurityError: a real
   * failure, never reported as success.
   */
  private exportarFirma(): string | null {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl && dataUrl.length > 0 ? dataUrl : null;
    } catch {
      return null;
    }
  }
}
