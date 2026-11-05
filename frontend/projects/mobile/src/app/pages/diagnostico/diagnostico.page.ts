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
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
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
import { ApiConfig } from '@core/service/api.config';
import { MockDbService } from '@core/service/mock-db.service';
import { ClientesApi } from '@core/service/clientes-api';
import { OtApi } from '@core/service/ot-api';
import { cargarOtDesdeRuta, otDesdeFuente, CargaOtEstado } from '@core/service/ot-carga';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { SseService } from '@core/service/sse.service';
import {
  EstadoOt,
  OtResponse,
  TarifaEstimadaResponse,
  TarifaFuente,
} from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';

/**
 * A7 — Technical diagnosis and budget (client).
 *
 * Replicates the web contract (diagnostico-ot-page) with two deliberate
 * differences:
 *
 * - The visit tariff is NOT queried on this screen: the visit fee is
 *   disclosed and charged in the OT flow (A6). The visit row shows
 *   "Por confirmar" instead of firing a second estimate.
 * - The chat with the technician is a non-interactive "Próximamente"
 *   banner; the real chat does not exist yet and is not simulated.
 *
 * Everything else is replicated: load with banner + Retry, SSE with a
 * 25 s poll fallback, dictamen with honest fallbacks, fixed three-row
 * breakdown and approve/reject CTAs only in EN_DIAGNOSTICO.
 */
@Component({
  selector: 'app-diagnostico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
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
  templateUrl: './diagnostico.page.html',
})
export class DiagnosticoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly sse = inject(SseService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(MobileToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** Load state: the failure is ALWAYS visible (with Retry). */
  private cargaOtEstado: CargaOtEstado | null = null;

  /** In mock mode reads the MockDb; against the backend uses the API-loaded OT. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  /**
   * Visit-tariff estimate. This screen NEVER queries it (see the header):
   * it stays `null` and the row shows "Por confirmar". The signal and the
   * total formula are kept identical to the web contract so the apps do
   * not diverge: if the visit flow publishes the estimate, the total
   * picks it up without touching this screen.
   */
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  /** Repair budget + estimated visit tariff (web contract). */
  readonly totalServicio = computed<number>(
    () => (this.ot()?.presupuesto?.total || 0) + (this.estimacion()?.tarifa ?? 0),
  );

  /** Technician dictamen with the web fallbacks; null = not loaded yet. */
  readonly dictamen = computed<string | null>(() => {
    const tecnico = this.ot()?.diagnostico;
    return tecnico?.diagnostico || tecnico?.fallaDetectada || null;
  });

  /** Labor: both fields are always set by the mapper; manoDeObra is legacy. */
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

  readonly mostrarRechazo = signal(false);
  readonly motivoRechazo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5)],
  });

  /** Header back: returns to the OT (or the panel if no id yet). */
  readonly backHref = computed(() =>
    this.otId() ? `/cliente/ot/${this.otId()}` : '/cliente/panel',
  );

  /** Fallback poll when SSE gives up; `null` while the stream is alive. */
  private suscripcionRespaldo: Subscription | null = null;

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
      // Silent reload (SSE or fallback): on failure keep what the screen
      // is showing; there is no user action to explain.
      error: () => undefined,
    });
  }

  /**
   * Live update: reload the OT when the backend pushes a change for the
   * same order. No toasts: the stream is a silent extra and, if it gives
   * up, the fallback poll takes over.
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

  etiquetaFuente(fuente: TarifaFuente): string {
    return fuente === 'ROAD' ? 'Ruta por carretera' : 'Distancia lineal';
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

  aprobarPresupuesto(): void {
    this.clientesApi.aprobarDiagnostico(this.otId()).subscribe({
      next: () => {
        this.toast.success(
          'Presupuesto aprobado',
          'El técnico ya puede iniciar la reparación del equipo.',
        );
        void this.router.navigate(['/cliente/ot', this.otId()]);
      },
      // No navigation: the approval was not recorded and the user must retry.
      error: (err: unknown) =>
        avisarErrorAccion(this.toast, 'No se pudo aprobar el presupuesto', err),
    });
  }

  abrirRechazo(): void {
    this.motivoRechazo.setValue('');
    this.motivoRechazo.markAsUntouched();
    this.mostrarRechazo.set(true);
  }

  cerrarRechazo(): void {
    this.mostrarRechazo.set(false);
  }

  rechazarPresupuesto(): void {
    if (this.motivoRechazo.invalid) return;

    this.clientesApi.rechazarDiagnostico(this.otId(), this.motivoRechazo.value).subscribe({
      next: () => {
        this.mostrarRechazo.set(false);
        this.toast.warning(
          'Presupuesto rechazado',
          'Se abrió un caso de mediación administrativa.',
        );
        void this.router.navigate(['/cliente/ot', this.otId()]);
      },
      // The panel stays open with the reason intact so the user can retry.
      error: (err: unknown) =>
        avisarErrorAccion(this.toast, 'No se pudo rechazar el presupuesto', err),
    });
  }

  /** Reject-form feedback without repeating the copy on the button. */
  ayudaMotivo(): string | null {
    if (this.motivoRechazo.pristine || !this.motivoRechazo.invalid) return null;
    return 'El motivo debe tener al menos 5 caracteres.';
  }
}
