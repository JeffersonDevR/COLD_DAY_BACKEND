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
  IonContent,
  IonHeader,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { AUXILIARES_MAX } from '@core/environment/auxiliares';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '@core/models/common.models';
import { SseService } from '@core/service/sse.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';

/** Only a 409 proves another technician took the order first. */
const MENSAJES_ACEPTAR_OFERTA: Record<number, string> = {
  409: 'Esta orden ya fue tomada por otro técnico en el perímetro.',
};

/** B1 — Offer radar for the technician (broadcast, first to accept wins). */
@Component({
  selector: 'app-ofertas-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonToolbar,
  ],
  templateUrl: './ofertas-tecnico.page.html',
})
export class OfertasTecnicoPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);
  private readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly ofertas = signal<OfertaTecnicoResponse[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly loadingOt = signal<string | null>(null);

  /** Auxiliares por OT; 0 = aceptar sin ayudantes. */
  private readonly auxiliaresPorOt = signal<Record<string, number>>({});

  readonly auxiliaresMax = AUXILIARES_MAX;
  readonly auxiliaresOpciones = Array.from({ length: AUXILIARES_MAX + 1 }, (_, i) => i);

  readonly validacionAprobada = computed(() => this.tecnico()?.estadoValidacion === 'APROBADO');
  readonly bloqueadoPorLiquidacion = computed(
    () => this.tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION',
  );

  ngOnInit(): void {
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        this.tecnico.set(tecnico);
        if (tecnico) {
          this.cargarOfertas(true);
        } else {
          this.cargando.set(false);
        }
      },
      (err) => {
        this.cargando.set(false);
        void avisarErrorAccion(this.toast, 'No pudimos cargar tu perfil de técnico', err);
      },
    );

    this.escucharOfertas();

    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOfertas(false));
  }

  private cargarOfertas(inicial: boolean): void {
    const tecnico = this.tecnico();
    if (!tecnico) {
      this.cargando.set(false);
      return;
    }
    if (inicial) this.cargando.set(true);
    this.tecnicosApi.getOfertasParaTecnico(tecnico.id).subscribe({
      next: (ofertas) => {
        this.errorCarga.set(false);
        this.cargando.set(false);
        this.ofertas.set(ofertas);
      },
      error: () => {
        this.cargando.set(false);
        if (!inicial) return;
        this.errorCarga.set(true);
      },
    });
  }

  reintentar(): void {
    this.errorCarga.set(false);
    this.cargarOfertas(true);
  }

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
          this.cargarOfertas(false);
        },
        error: () => undefined,
      });
  }

  auxiliaresDe(otId: string): number {
    return this.auxiliaresPorOt()[otId] ?? 0;
  }

  setAuxiliares(otId: string, valor: number): void {
    const numero = Number(valor);
    this.auxiliaresPorOt.update((mapa) => ({
      ...mapa,
      [otId]: Number.isInteger(numero) && numero >= 0 ? numero : 0,
    }));
  }

  aceptar(oferta: OfertaTecnicoResponse): void {
    const tecnico = this.tecnico();
    if (!tecnico) {
      void this.toast.error('Error', 'No encontramos tu perfil de técnico.');
      return;
    }
    if (!this.validacionAprobada()) {
      void this.toast.error(
        'Cuenta no habilitada',
        'Tu documentación todavía no está aprobada: no podés tomar servicios.',
      );
      return;
    }
    if (this.bloqueadoPorLiquidacion()) {
      void this.toast.error(
        'Operación bloqueada',
        'Debés legalizar tus liquidaciones pendientes para tomar servicios.',
      );
      return;
    }

    const auxiliares = this.auxiliaresDe(oferta.ot.id);
    if (!Number.isInteger(auxiliares) || auxiliares < 0 || auxiliares > AUXILIARES_MAX) {
      void this.toast.error(
        'Auxiliares inválidos',
        `Indicá un número entero entre 0 y ${AUXILIARES_MAX}. Usá 0 si no necesitás ayudantes.`,
      );
      return;
    }

    this.loadingOt.set(oferta.ot.id);
    this.tecnicosApi.aceptarOferta(oferta.id, tecnico.id, auxiliares).subscribe({
      next: () => {
        this.loadingOt.set(null);
        const detalle = auxiliares > 0 ? ` con ${auxiliares} auxiliar(es)` : '';
        void this.toast.success(
          '¡Servicio asignado!',
          `Tomaste la orden ${oferta.ot.codigo || 'sin código'}${detalle}. Desplazate al domicilio.`,
        );
        // B3 (ejecución) ya existe: se abre directo en la OT tomada.
        void this.router.navigate(['/tecnico/ejecucion', oferta.ot.id]);
      },
      error: (err: Error) => {
        this.loadingOt.set(null);
        const concurrencia = err instanceof ApiHttpError && err.status === 409;
        void avisarErrorAccion(
          this.toast,
          concurrencia ? 'Error de concurrencia' : 'No se pudo tomar la orden',
          err,
          MENSAJES_ACEPTAR_OFERTA,
        );
      },
    });
  }

  distancia(km: number): string {
    return `${km.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
  }

  expira(segundos: number): string {
    const total = Math.max(0, Math.floor(segundos));
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return minutos > 0 ? `${minutos}m ${resto}s` : `${resto}s`;
  }

  trackOt(_: number, oferta: OfertaTecnicoResponse): string {
    return oferta.id;
  }
}
