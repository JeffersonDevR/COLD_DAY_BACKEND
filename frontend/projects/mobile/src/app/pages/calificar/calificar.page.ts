import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTextarea,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { ApiConfig } from '@core/service/api.config';
import { ClientesApi } from '@core/service/clientes-api';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { MockDbService } from '@core/service/mock-db.service';
import { CargaOtEstado, cargarOtDesdeRuta, otDesdeFuente } from '@core/service/ot-carga';
import { OtApi } from '@core/service/ot-api';
import { EstadoOt, OtResponse } from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';

/**
 * Owner-side copy for the backend 409 (`CalificacionInvalidaException`): the
 * order is not FINALIZADA, was already rated or has no technician. Retrying
 * cannot change any of those, so the message must not suggest it.
 */
const MENSAJES_CALIFICACION: Record<number, string> = {
  409: 'Esta orden todavía no se puede calificar: puede ser que aún no esté finalizada o que ya tengas una reseña registrada.',
};

/** A9 — Calificar servicio (client). Mirrors the web contract 1:1. */
@Component({
  selector: 'app-calificar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTextarea,
    IonToolbar,
  ],
  templateUrl: './calificar.page.html',
})
export class CalificarPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(MobileToastService);

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** Load state: a failure is always visible with Retry, never a blank page. */
  private cargaOtEstado: CargaOtEstado | null = null;

  /** In mock mode reads the MockDb; against the backend uses the API-loaded OT. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  /** No default: the client must choose. Sending with 0 is blocked twice. */
  readonly estrellas = signal<number>(0);
  readonly tagsSeleccionados = signal<string[]>([]);
  readonly comentarioCtrl = new FormControl('');

  readonly enviando = signal(false);

  /** Exactly the web's six aspects, in order. */
  readonly tagsDisponibles = [
    'Puntualidad en llegada',
    'Limpieza del área',
    'Calidad técnica impecable',
    'Explicación clara del problema',
    'Uso de repuestos originales',
    'Trato respetuoso y honesto',
  ];

  /** The backend only accepts ratings on FINALIZADA orders. */
  readonly estaFinalizada = computed<boolean>(() => this.ot()?.estado === 'FINALIZADA');

  /** Ratings are one-shot once the OT carries one. */
  readonly yaCalificada = computed<boolean>(() => Boolean(this.ot()?.calificacion));

  readonly puedeEnviar = computed<boolean>(
    () => this.estrellas() > 0 && this.estaFinalizada() && !this.yaCalificada() && !this.enviando(),
  );

  readonly backHref = computed<string>(() =>
    this.otId() ? `/cliente/ot/${this.otId()}` : '/cliente/panel',
  );

  ngOnInit(): void {
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => this.otId.set(id),
      (orden) => this._otRemoto.set(orden),
    );
  }

  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  /** `true` while there is neither OT nor error to show (initial load). */
  cargandoInicial(): boolean {
    return !this.ot() && !this.otErrorCarga();
  }

  elegirEstrellas(valor: number): void {
    this.estrellas.set(valor);
  }

  toggleTag(tag: string): void {
    const actuales = this.tagsSeleccionados();
    this.tagsSeleccionados.set(
      actuales.includes(tag) ? actuales.filter((t) => t !== tag) : [...actuales, tag],
    );
  }

  tieneTag(tag: string): boolean {
    return this.tagsSeleccionados().includes(tag);
  }

  /**
   * Payload contract (web parity): the aspects bracket is ALWAYS appended,
   * even with zero tags. The server sanitizes blanks to null.
   */
  construirComentario(): string {
    return `${this.comentarioCtrl.value || ''} [Aspectos: ${this.tagsSeleccionados().join(', ')}]`;
  }

  enviarCalificacion(): void {
    if (!this.puedeEnviar()) return;

    this.enviando.set(true);
    this.clientesApi
      .calificarServicio(this.otId(), this.estrellas(), this.construirComentario())
      .subscribe({
        next: () => {
          this.enviando.set(false);
          void this.toast.success(
            '¡Gracias por tu opinión!',
            'Tu reseña quedó registrada y la reputación del técnico se actualizó.',
          );
          void this.router.navigate(['/cliente/ot', this.otId()]);
        },
        error: (err: Error) => {
          this.enviando.set(false);
          void avisarErrorAccion(
            this.toast,
            'Calificación no disponible',
            err,
            MENSAJES_CALIFICACION,
          );
        },
      });
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }
}
