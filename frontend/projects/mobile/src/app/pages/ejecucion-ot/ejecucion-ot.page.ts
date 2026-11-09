import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonToolbar,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { ApiConfig } from '@core/service/api.config';
import { MockDbService } from '@core/service/mock-db.service';
import { SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { CargaOtEstado, cargarOtDesdeRuta, otDesdeFuente } from '@core/service/ot-carga';
import { OtApi } from '@core/service/ot-api';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import {
  EstadoOt,
  MedioPago,
  OtResponse,
  SolicitudInsumoResponse,
} from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';
import { FotoLocalComponent } from '../../shared/foto-local/foto-local';
import { ActivatedRoute } from '@angular/router';

/** Only a 409 proves the client has not paid yet or the order moved elsewhere. */
const MENSAJES_DESPLAZAMIENTO: Record<number, string> = {
  409: 'No se pudo iniciar el desplazamiento: el cliente puede no haber pagado la visita todavía, o la orden cambió de estado en otro dispositivo. Actualizá e intentá de nuevo.',
};

/** B3 — Technician execution: travel, arrival, diagnosis and closure. */
@Component({
  selector: 'app-ejecucion-ot',
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
    IonInput,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTextarea,
    IonToolbar,
    FotoLocalComponent,
  ],
  templateUrl: './ejecucion-ot.page.html',
})
export class EjecucionOtPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly otApi = inject(OtApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly presencia = inject(TecnicoPresenciaService);
  private readonly sse = inject(SseService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(MobileToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly otId = signal('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  private cargaOtEstado: CargaOtEstado | null = null;
  private suscripcionRespaldo: Subscription | null = null;

  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly enSitio = signal(false);
  readonly enviandoDiagnostico = signal(false);
  readonly finalizando = signal(false);
  readonly insumosOt = signal<SolicitudInsumoResponse[]>([]);
  readonly medioPagoCierre = signal<MedioPago>('EFECTIVO');

  readonly visitaPagada = computed(() => this.ot()?.visitaPagada === true);
  readonly desplazamientoBloqueadoPorPago = computed(
    () => this.ot()?.estado === 'ASIGNADA' && this.ot()?.visitaPagada === false,
  );
  readonly mostrarDiagnostico = computed(() => {
    const estado = this.ot()?.estado;
    return estado === 'EN_DIAGNOSTICO' || (estado === 'EN_CAMINO' && this.enSitio());
  });

  readonly diagnosticoForm = new FormGroup({
    diagnostico: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    manoDeObra: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    repuestos: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  readonly insumos = new FormArray<FormGroup>([]);

  readonly totalPresupuesto = computed<number>(() => {
    const valor = this.diagnosticoForm.getRawValue();
    return (valor.manoDeObra ?? 0) + (valor.repuestos ?? 0);
  });

  constructor() {
    effect(() => this.presencia.sincronizarOt(this.ot()));
  }

  ngOnInit(): void {
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.escucharCambiosDeEstado(id);
        this.cargarInsumos();
      },
      (orden) => this._otRemoto.set(orden),
    );
  }

  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  cargandoInicial(): boolean {
    return !this.ot() && !this.otErrorCarga();
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => this._otRemoto.set(orden),
      error: () => undefined,
    });
  }

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

  private iniciarPollDeRespaldo(): void {
    if (this.suscripcionRespaldo) return;
    this.suscripcionRespaldo = pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOt());
  }

  private cargarInsumos(): void {
    this.tecnicosApi.getInsumosOt(this.otId()).subscribe({
      next: (insumos) => this.insumosOt.set(insumos),
      error: () => undefined,
    });
  }

  iniciarDesplazamiento(): void {
    if (this.desplazamientoBloqueadoPorPago()) {
      void this.toast.info(
        'Visita pendiente de pago',
        'El cliente debe pagar la visita antes de que puedas iniciar el desplazamiento.',
      );
      return;
    }
    this.tecnicosApi.iniciarDesplazamiento(this.otId()).subscribe({
      next: () => {
        void this.toast.info('En camino', 'El cliente puede rastrear tu trayecto en vivo.');
        this.recargarOt();
      },
      error: (err: Error) =>
        void avisarErrorAccion(
          this.toast,
          'No se pudo iniciar el desplazamiento',
          err,
          MENSAJES_DESPLAZAMIENTO,
        ),
    });
  }

  llegarADomicilio(): void {
    this.tecnicosApi.llegarADomicilio(this.otId()).subscribe({
      next: () => {
        this.enSitio.set(true);
        this.recargarOt();
        void this.toast.success('Llegada registrada', 'Registrá el diagnóstico y el presupuesto.');
      },
      error: (err: Error) =>
        void avisarErrorAccion(this.toast, 'No se pudo registrar la llegada', err),
    });
  }

  agregarInsumo(): void {
    this.insumos.push(
      new FormGroup({
        descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        cantidad: new FormControl(1, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1)],
        }),
      }),
    );
  }

  quitarInsumo(index: number): void {
    this.insumos.removeAt(index);
  }

  enviarDiagnostico(): void {
    if (this.diagnosticoForm.invalid || this.insumos.invalid) {
      this.diagnosticoForm.markAllAsTouched();
      return;
    }
    if (this.enviandoDiagnostico()) return;

    const valor = this.diagnosticoForm.getRawValue();
    const insumos = this.insumos.controls.map((grupo) => {
      const linea = grupo.getRawValue() as { descripcion: string; cantidad: number };
      return { descripcion: linea.descripcion.trim(), cantidad: linea.cantidad };
    });

    this.enviandoDiagnostico.set(true);
    this.tecnicosApi
      .registrarDiagnostico(this.otId(), {
        diagnostico: valor.diagnostico.trim(),
        manoDeObra: valor.manoDeObra ?? undefined,
        repuestos: valor.repuestos ?? undefined,
        insumos,
      })
      .subscribe({
        next: () => {
          this.enviandoDiagnostico.set(false);
          this.insumos.clear();
          this.diagnosticoForm.reset();
          this.recargarOt();
          void this.toast.success(
            'Presupuesto notificado',
            'El cliente recibió la cotización para su aprobación.',
          );
        },
        error: (err: Error) => {
          this.enviandoDiagnostico.set(false);
          void avisarErrorAccion(this.toast, 'No se pudo enviar el diagnóstico', err);
        },
      });
  }

  finalizarServicio(): void {
    if (this.finalizando()) return;
    this.finalizando.set(true);
    this.tecnicosApi.finalizarServicio(this.otId(), this.medioPagoCierre()).subscribe({
      next: () => {
        this.finalizando.set(false);
        this.presencia.liberarContexto();
        this.recargarOt();
        void this.toast.success('Servicio finalizado', 'El cliente ya puede ver el acta y calificar.');
      },
      error: (err: Error) => {
        this.finalizando.set(false);
        void avisarErrorAccion(this.toast, 'No se pudo finalizar el servicio', err);
      },
    });
  }

  irAlPanel(): void {
    void this.router.navigate(['/tecnico/ots']);
  }

  etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  tonoEstado(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }

  etiquetaInsumo(estado: string): string {
    switch (estado) {
      case 'SOLICITADO':
        return 'Solicitado';
      case 'ASIGNADO':
        return 'Asignado';
      case 'ENTREGADO':
        return 'Entregado';
      case 'SIN_PROVEEDOR':
        return 'Sin proveedor';
      default:
        return estado;
    }
  }
}
