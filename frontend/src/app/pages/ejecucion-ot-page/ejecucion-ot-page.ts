import { ChangeDetectionStrategy, Component, effect, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { MapsApi } from '../../core/service/maps-api';
import { OtApi } from '../../modules/ot/infrastructure/ot-api';
import { calcularRuta, cargarOtDesdeRuta, otDesdeFuente } from '../../modules/ot/infrastructure/ot-carga';
import { LiquidacionApi } from '../../modules/liquidacion/infrastructure/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtResponse, MedioPago } from '../../core/models/common.models';

@Component({
  selector: 'app-ejecucion-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge],
  templateUrl: './ejecucion-ot-page.html',
})
export class EjecucionOtPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly mockDb = inject(MockDbService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly tracking = inject(TecnicoTrackingService);
  private readonly mapsApi = inject(MapsApi);
  private readonly otApi = inject(OtApi);
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly toast = inject(ToastService);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);

  /** En mock lee del MockDb (reactivo); contra el backend usa la OT cargada por API. */
  readonly ot = otDesdeFuente(this.apiConfig, this.mockDb, this.otId, this._otRemoto);

  readonly medioPagoCierre = signal<MedioPago>('EFECTIVO');
  readonly distanciaKm = signal<number | null>(null);
  readonly etaMin = signal<number | null>(null);
  /** Marca local: el técnico confirmó llegada y se habilita el diagnóstico. */
  readonly enSitio = signal<boolean>(false);

  constructor() {
    // Recalcula distancia/ETA al cliente cada vez que cambia la posición del técnico.
    effect(() => {
      calcularRuta(this.mapsApi, this.tracking.ultimaPosicion(), this.ot()?.punto, (ruta) => {
        this.distanciaKm.set(ruta.distanciaKm);
        this.etaMin.set(ruta.duracionMin);
      });
    });
  }

  readonly diagnosticoForm = new FormGroup({
    diagnostico: new FormControl('Condensador con suciedad severa y capacitor desvalorizado. Requiere lavado químico y reemplazo de capacitor 45uF.', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    manoDeObra: new FormControl(80000, { nonNullable: true, validators: [Validators.required] }),
    repuestos: new FormControl(70000, { nonNullable: true, validators: [Validators.required] }),
    tiempoEstimadoHoras: new FormControl(2, { nonNullable: true, validators: [Validators.required] })
  });

  /** Líneas de insumo declaradas por el técnico; cero líneas es un caso normal. */
  readonly insumos = new FormArray<FormGroup>([]);

  private nuevaLineaInsumo(): FormGroup {
    return new FormGroup({
      descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      cantidad: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    });
  }

  agregarInsumo(): void {
    this.insumos.push(this.nuevaLineaInsumo());
  }

  quitarInsumo(index: number): void {
    this.insumos.removeAt(index);
  }

  ngOnInit(): void {
    cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.enSitio.set(false);
      },
      (orden) => this._otRemoto.set(orden),
    );
    // Empuja la ubicación del técnico mientras ejecuta el servicio.
    this.tracking.iniciar();
  }

  ngOnDestroy(): void {
    this.tracking.detener();
  }

  iniciarDesplazamiento(): void {
    this.tecnicosApi.iniciarDesplazamiento(this.otId()).subscribe({
      next: () => {
        this.toast.info('En Camino', 'El cliente puede rastrear tu trayecto en vivo.');
        this.recargarOt();
      }
    });
  }

  /**
   * Confirma la llegada: persiste el hecho en el backend
   * (POST /api/ot/{id}/llegada) y habilita localmente el formulario de diagnóstico.
   * El backend no cambia el estado en esta llamada; la OT avanza a EN_DIAGNOSTICO
   * cuando se registra el diagnóstico (POST /api/ot/{id}/diagnostico).
   */
  llegarADomicilio(): void {
    this.tecnicosApi.llegarADomicilio(this.otId()).subscribe({
      next: () => {
        this.enSitio.set(true);
        this.toast.success('Llegada Registrada', 'Registra el diagnóstico y presupuesto del equipo.');
      }
    });
  }

  enviarDiagnostico(): void {
    if (this.diagnosticoForm.invalid || this.insumos.invalid) return;

    const val = this.diagnosticoForm.getRawValue();
    const insumos = this.insumos.controls.map((grupo) => {
      const linea = grupo.getRawValue() as { descripcion: string; cantidad: number };
      return { descripcion: linea.descripcion.trim(), cantidad: linea.cantidad };
    });

    this.tecnicosApi.registrarDiagnostico(this.otId(), { ...val, insumos }).subscribe({
      next: () => {
        const detalle =
          insumos.length > 0 ? ` Se despacharon ${insumos.length} insumo(s) a los proveedores.` : '';
        this.toast.success('Presupuesto Notificado', `El cliente ha recibido la cotización para su aprobación.${detalle}`);
        this.recargarOt();
      }
    });
  }

  finalizarServicio(): void {
    this.tecnicosApi.finalizarServicio(this.otId(), this.medioPagoCierre()).subscribe({
      next: () => {
        this.tracking.detener();
        this.recargarOt();
        this.registrarPagoCierre();
      }
    });
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({
      next: (orden) => this._otRemoto.set(orden),
    });
  }

  /**
   * Tras finalizar, el técnico registra el monto y el medio cobrados.
   * El backend exige la OT en FINALIZADA y `montoCobrado >= 0.01`.
   */
  private registrarPagoCierre(): void {
    const monto = this.ot()?.presupuesto?.total ?? 0;
    if (monto < 0.01) {
      this.toast.info(
        'Servicio Completado',
        'No se registró el pago: la OT no tiene un monto de presupuesto disponible.'
      );
      return;
    }

    if (this.apiConfig.useMocks()) {
      // En modo mock `finalizarServicio` ya crea la liquidación y bloquea al técnico;
      // llamar a registrarPago generaría una segunda liquidación duplicada.
      this.toast.success(
        'Servicio Completado',
        'Acta de 90 días certificada y liquidación registrada.'
      );
      return;
    }

    this.liquidacionApi.registrarPago(this.otId(), monto, this.medioPagoCierre()).subscribe({
      next: () => {
        this.toast.success(
          'Servicio Completado',
          'Acta de 90 días certificada y liquidación registrada.'
        );
      }
    });
  }
}
