import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { TecnicoTrackingService } from '../infrastructure/tecnico-tracking.service';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { LiquidacionApi } from '../../liquidacion/infrastructure/liquidacion-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { OtResponse, MedioPago } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-ejecucion-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, EstadoBadge],
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-4xl mx-auto">
        <div>
          <a routerLink="/tecnico/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <i class="pi pi-arrow-left text-xs"></i> Volver al Panel Técnico
          </a>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                Ejecución OT: {{ orden.id }}
              </h1>
              <app-estado-badge [estado]="orden.estado" />
            </div>
            <a
              [href]="'tel:' + orden.clienteTelefono"
              class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <i class="pi pi-phone text-sm"></i>
              Llamar al Cliente
            </a>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            {{ orden.clienteNombre }} • {{ orden.direccion }} ({{ orden.barrio || 'Cúcuta' }})
          </p>
        </div>

        <!-- Paso a Paso Operativo del Técnico -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-6">
            <!-- 1. En Desplazamiento / Llegada -->
            @if (orden.estado === 'ASIGNADA') {
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div class="flex items-center gap-3 text-sky-600">
                  <i class="pi pi-truck text-3xl"></i>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Paso 1: Desplazamiento</h3>
                    <p class="text-xs text-slate-500">Inicia tu trayecto hacia el domicilio del cliente</p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="iniciarDesplazamiento()"
                  class="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <i class="pi pi-directions"></i>
                  Iniciar Desplazamiento (En Camino)
                </button>
              </div>
            }

            @if (orden.estado === 'EN_CAMINO' && !enSitio()) {
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div class="flex items-center gap-3 text-indigo-600">
                  <i class="pi pi-map-marker text-3xl"></i>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Paso 2: Llegada a Sitio</h3>
                    <p class="text-xs text-slate-500">Confirma que estás en el domicilio para comenzar la inspección física</p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="llegarADomicilio()"
                  class="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <i class="pi pi-check-circle"></i>
                  He llegado al domicilio (Iniciar Diagnóstico)
                </button>
              </div>
            }

            <!-- 2. Formulario de Diagnóstico y Presupuesto Técnico -->
            @if (orden.estado === 'EN_DIAGNOSTICO' || (orden.estado === 'EN_CAMINO' && enSitio())) {
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
                <div class="flex items-center gap-3 text-amber-500">
                  <i class="pi pi-wrench text-3xl"></i>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Paso 3: Registrar Diagnóstico y Presupuesto</h3>
                    <p class="text-xs text-slate-500">Especifica la falla y cotización para autorización del cliente</p>
                  </div>
                </div>

                <form [formGroup]="diagnosticoForm" (ngSubmit)="enviarDiagnostico()" class="space-y-4">
                  <div>
                    <label for="diagnostico-oficial" class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                       Dictamen Técnico Oficial *
                    </label>
                    <textarea
                      id="diagnostico-oficial"
                      rows="3"
                      formControlName="diagnostico"
                      placeholder="Explica la avería encontrada en el equipo..."
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500"
                    ></textarea>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label for="mano-obra" class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Mano de Obra (COP) *</label>
                      <input
                        id="mano-obra"
                        type="number"
                        formControlName="manoDeObra"
                        class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label for="repuestos-cop" class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Repuestos (COP) *</label>
                      <input
                        id="repuestos-cop"
                        type="number"
                        formControlName="repuestos"
                        class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label for="tiempo-estimado" class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Tiempo Estimado (Horas) *</label>
                      <input
                        id="tiempo-estimado"
                        type="number"
                        formControlName="tiempoEstimadoHoras"
                        class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between font-bold">
                    <span>Total Presupuesto a Enviar al Cliente:</span>
                    <span class="text-sm">$ {{ (diagnosticoForm.getRawValue().manoDeObra + diagnosticoForm.getRawValue().repuestos).toLocaleString('es-CO') }} COP</span>
                  </div>

                  <button
                    type="submit"
                    [disabled]="diagnosticoForm.invalid"
                    class="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <i class="pi pi-send text-sm"></i>
                    Enviar Presupuesto al Cliente para Aprobación
                  </button>
                </form>
              </div>
            }

            <!-- 3. En Reparación -->
            @if (orden.estado === 'EN_REPARACION') {
              <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div class="flex items-center gap-3 text-emerald-600">
                  <i class="pi pi-wrench text-3xl"></i>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Paso 4: Ejecución de Reparación</h3>
                    <p class="text-xs text-slate-500">Presupuesto aprobado por el cliente. Realiza la intervención y pruebas técnicas.</p>
                  </div>
                </div>

                <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs space-y-1">
                  <span class="font-bold block">Protocolo de Cierre:</span>
                  <p>1. Instala los repuestos sellados.</p>
                  <p>2. Realiza prueba de funcionamiento por 10 minutos (temperatura / presurización).</p>
                  <p>3. Recibe el pago y solicita firma del acta de garantía.</p>
                </div>

                <div class="pt-2">
                  <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Medio en que el cliente realizó el pago:</span>
                  <div class="flex gap-3 mb-4">
                    <button
                      type="button"
                      (click)="medioPagoCierre.set('EFECTIVO')"
                      class="flex-1 p-3 rounded-xl border text-xs font-bold transition-all"
                      [class.bg-sky-50]="medioPagoCierre() === 'EFECTIVO'"
                      [class.border-sky-500]="medioPagoCierre() === 'EFECTIVO'"
                      [class.border-slate-200]="medioPagoCierre() !== 'EFECTIVO'"
                    >
                      Efectivo en Sitio
                    </button>
                    <button
                      type="button"
                      (click)="medioPagoCierre.set('TRANSFERENCIA')"
                      class="flex-1 p-3 rounded-xl border text-xs font-bold transition-all"
                      [class.bg-sky-50]="medioPagoCierre() === 'TRANSFERENCIA'"
                      [class.border-sky-500]="medioPagoCierre() === 'TRANSFERENCIA'"
                      [class.border-slate-200]="medioPagoCierre() !== 'TRANSFERENCIA'"
                    >
                      Transferencia (Nequi/Bancolombia)
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="finalizarServicio()"
                    class="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <i class="pi pi-check-circle"></i>
                    Concluir Servicio y Emitir Acta
                  </button>
                </div>
              </div>
            }

            <!-- 4. Finalizada -->
            @if (orden.estado === 'FINALIZADA') {
              <div class="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 space-y-3">
                <div class="flex items-center gap-3">
                  <i class="pi pi-verified text-3xl text-emerald-600"></i>
                  <div>
                    <h3 class="text-base font-bold">Servicio Concluido a Satisfacción</h3>
                    <p class="text-xs text-emerald-700 dark:text-emerald-300">Acta de 90 días emitida. Se registró la liquidación correspondiente.</p>
                  </div>
                </div>
                <div class="pt-2 flex justify-end">
                  <a
                    routerLink="/tecnico/liquidaciones"
                    class="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                  >
                    Ver Liquidación de este Servicio
                  </a>
                </div>
              </div>
            }
          </div>

          <!-- Columna Lateral: Ficha del Requerimiento -->
          <div class="space-y-4">
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-xs">
              <h3 class="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Detalles de la OT</h3>
              <div class="space-y-2">
                <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Línea:</span>
                  <span class="font-bold">{{ orden.categoriaServicio.replace('_', ' ') }}</span>
                </div>
                <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Cliente:</span>
                  <span class="font-bold">{{ orden.clienteNombre }}</span>
                </div>
                <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Dirección:</span>
                  <span class="font-bold text-right">{{ orden.direccion }}</span>
                </div>
                <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Barrio:</span>
                  <span class="font-bold">{{ orden.barrio || 'Cúcuta' }}</span>
                </div>
                @if (etaMin() !== null) {
                  <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span class="text-slate-500">ETA al cliente:</span>
                    <span class="font-bold text-sky-600">{{ etaMin() }} min · {{ distanciaKm() }} km</span>
                  </div>
                }
              </div>

              <div class="pt-2">
                <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Falla Reportada por Cliente:</span>
                <p class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                  {{ orden.descripcionFalla }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `
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
  readonly ot = computed<OtResponse | undefined>(() => {
    if (this.apiConfig.useMocks()) {
      return this.mockDb.ordenesTrabajo().find(o => o.id === this.otId());
    }
    return this._otRemoto();
  });

  readonly medioPagoCierre = signal<MedioPago>('EFECTIVO');
  readonly distanciaKm = signal<number | null>(null);
  readonly etaMin = signal<number | null>(null);
  /** Marca local: el técnico confirmó llegada y se habilita el diagnóstico. */
  readonly enSitio = signal<boolean>(false);

  constructor() {
    // Recalcula distancia/ETA al cliente cada vez que cambia la posición del técnico.
    effect(() => {
      const origen = this.tracking.ultimaPosicion();
      const destino = this.ot()?.punto;
      if (!origen || !destino) {
        return;
      }
      this.mapsApi.distancia(origen, destino).subscribe({
        next: (ruta) => {
          this.distanciaKm.set(ruta.distanciaKm);
          this.etaMin.set(ruta.duracionMin);
        },
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

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.otId.set(id);
        this.enSitio.set(false);
        // Carga la OT de la fuente activa (mock o API real) para conocer estado y monto.
        this.recargarOt();
      }
    });
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
   * Confirmación de llegada local: habilita el formulario de diagnóstico.
   * La transición real EN_CAMINO → EN_DIAGNOSTICO la hace el backend al
   * registrar el diagnóstico (POST /api/ot/{id}/diagnostico).
   */
  llegarADomicilio(): void {
    this.enSitio.set(true);
    this.toast.success('Llegada Registrada', 'Registra el diagnóstico y presupuesto del equipo.');
  }

  enviarDiagnostico(): void {
    if (this.diagnosticoForm.invalid) return;

    const val = this.diagnosticoForm.getRawValue();
    this.tecnicosApi.registrarDiagnostico(this.otId(), val).subscribe({
      next: () => {
        this.toast.success('Presupuesto Notificado', 'El cliente ha recibido la cotización para su aprobación.');
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
