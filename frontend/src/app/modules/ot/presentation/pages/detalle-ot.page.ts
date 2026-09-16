import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ETIQUETA_ESTADO_OT,
  EstadoOt,
  esEstadoTerminal,
} from '../../domain/models/estado-ot.model';
import { ETIQUETA_CATEGORIA, OrdenTrabajo } from '../../domain/models/orden-trabajo.model';
import { OtFacadeService } from '../../application/ot-facade.service';
import { EstadoOtBadge } from '../components/estado-ot-badge';

@Component({
  selector: 'app-detalle-ot',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, EstadoOtBadge],
  template: `
    <section class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <a
        routerLink="/ot"
        class="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        ← Volver al monitoreo
      </a>

      @if (error(); as mensaje) {
        <div
          class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {{ mensaje }}
        </div>
      }

      @if (orden(); as ot) {
        <header
          class="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">{{ ot.id }}</h1>
              <app-estado-ot-badge [estado]="ot.estado" />
            </div>
            <p class="mt-1 text-sm text-slate-500">{{ etiquetaCategoria(ot) }}</p>
          </div>
          <dl class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <dt class="text-xs font-medium text-slate-500 uppercase">Creada</dt>
              <dd class="text-slate-800">{{ ot.creadaEn | date: 'dd/MM/yyyy HH:mm' }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-slate-500 uppercase">Actualizada</dt>
              <dd class="text-slate-800">{{ ot.actualizadaEn | date: 'dd/MM/yyyy HH:mm' }}</dd>
            </div>
          </dl>
        </header>

        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Solicitud</h2>
            <dl class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs font-medium text-slate-500 uppercase">Cliente</dt>
                <dd class="text-sm text-slate-900">{{ ot.clienteNombre }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500 uppercase">Técnico</dt>
                <dd class="text-sm text-slate-900">{{ ot.tecnicoNombre ?? 'Sin asignar' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500 uppercase">Dirección</dt>
                <dd class="text-sm text-slate-900">
                  {{ ot.direccion }}
                  @if (ot.barrio) {
                    · {{ ot.barrio }}
                  }
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-slate-500 uppercase">Radio de difusión</dt>
                <dd class="text-sm text-slate-900">{{ ot.radioKm }} km</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-slate-500 uppercase">Falla reportada</dt>
                <dd class="text-sm text-slate-900">{{ ot.descripcionFalla }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Diagnóstico y presupuesto
            </h2>
            @if (ot.diagnostico; as diagnostico) {
              <dl class="mt-3 space-y-2 text-sm">
                <div>
                  <dt class="text-xs font-medium text-slate-500 uppercase">Falla detectada</dt>
                  <dd class="text-slate-900">{{ diagnostico.fallaDetectada }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">Mano de obra</dt>
                  <dd class="text-slate-900">
                    {{ diagnostico.costoManoObra | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">Repuestos</dt>
                  <dd class="text-slate-900">
                    {{ diagnostico.costoRepuestos | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                  </dd>
                </div>
                @if (ot.presupuesto; as presupuesto) {
                  <div class="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                    <dt class="text-slate-700">Total</dt>
                    <dd class="text-slate-900">
                      {{ presupuesto.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                    </dd>
                  </div>
                }
              </dl>
            } @else {
              <p class="mt-3 text-sm text-slate-400">Aún no se ha registrado diagnóstico.</p>
            }
            @if (ot.tarifaVisita > 0) {
              <p class="mt-3 text-xs text-amber-700">
                Tarifa de visita:
                {{ ot.tarifaVisita | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </p>
            }
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Trazabilidad
            </h2>
            <ol class="mt-4 space-y-4">
              @for (paso of ot.historial; track $index) {
                <li class="relative border-l border-slate-200 pl-4">
                  <span
                    class="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-500"
                  ></span>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-slate-900">
                      {{ etiquetaEstado(paso.estado) }}
                    </span>
                    <span
                      class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {{ paso.actor }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500">{{ paso.fecha | date: 'dd/MM/yyyy HH:mm' }}</p>
                  @if (paso.motivo) {
                    <p class="mt-1 text-sm text-slate-600">{{ paso.motivo }}</p>
                  }
                </li>
              }
            </ol>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">Acciones</h2>

            @if (ot.estado === 'BUSCANDO_TECNICO') {
              <button
                type="button"
                (click)="asignarTecnico()"
                class="mt-3 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Asignar técnico (demo)
              </button>
            }

            @if (ot.estado === 'ASIGNADA') {
              <button
                type="button"
                (click)="iniciarDesplazamiento()"
                class="mt-3 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Iniciar desplazamiento
              </button>
            }

            @if (ot.estado === 'EN_CAMINO' || ot.estado === 'EN_DIAGNOSTICO') {
              <button
                type="button"
                (click)="alternarFormularioDiagnostico()"
                class="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {{ mostrarDiagnostico() ? 'Ocultar diagnóstico' : 'Registrar diagnóstico' }}
              </button>

              @if (mostrarDiagnostico()) {
                <form
                  [formGroup]="diagnosticoForm"
                  (ngSubmit)="registrarDiagnostico()"
                  class="mt-3 space-y-3"
                >
                  <div>
                    <label class="text-xs font-medium text-slate-600" for="falla"
                      >Falla detectada</label
                    >
                    <input
                      id="falla"
                      type="text"
                      formControlName="fallaDetectada"
                      class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="text-xs font-medium text-slate-600" for="mano"
                        >Mano de obra</label
                      >
                      <input
                        id="mano"
                        type="number"
                        min="0"
                        formControlName="costoManoObra"
                        class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label class="text-xs font-medium text-slate-600" for="repuestos">
                        Repuestos
                      </label>
                      <input
                        id="repuestos"
                        type="number"
                        min="0"
                        formControlName="costoRepuestos"
                        class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-slate-600" for="obs"
                      >Observaciones</label
                    >
                    <input
                      id="obs"
                      type="text"
                      formControlName="observaciones"
                      class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Guardar diagnóstico
                  </button>
                </form>
              }
            }

            @if (ot.estado === 'EN_DIAGNOSTICO') {
              <div class="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  (click)="aprobarPresupuesto()"
                  class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Aprobar presupuesto
                </button>
                <button
                  type="button"
                  (click)="rechazarPresupuesto()"
                  class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Rechazar
                </button>
              </div>
            }

            @if (ot.estado === 'EN_REPARACION') {
              <button
                type="button"
                (click)="finalizar()"
                class="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Finalizar servicio
              </button>
            }

            @if (ot.estado === 'DISPUTADA') {
              <div class="mt-3 space-y-2">
                <button
                  type="button"
                  (click)="resolverDisputa(true)"
                  class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Resolver con acuerdo
                </button>
                <button
                  type="button"
                  (click)="resolverDisputa(false)"
                  class="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Resolver sin acuerdo
                </button>
              </div>
            }

            @if (!esTerminal(ot.estado)) {
              <div class="mt-4 border-t border-slate-200 pt-4">
                <label class="text-xs font-medium text-slate-600" for="motivo">
                  Motivo de cancelación
                </label>
                <input
                  id="motivo"
                  type="text"
                  [formControl]="motivoCtrl"
                  placeholder="Describe el motivo"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  (click)="cancelar()"
                  class="mt-3 w-full rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Cancelar OT
                </button>
              </div>
            }

            @if (esTerminal(ot.estado)) {
              <p class="mt-3 text-sm text-slate-400">
                Esta orden está en un estado terminal; no admite más acciones.
              </p>
            }
          </div>
        </div>
      } @else if (cargando()) {
        <p class="mt-8 text-center text-sm text-slate-500" role="status">
          Cargando orden de trabajo…
        </p>
      } @else {
        <p class="mt-8 text-center text-sm text-slate-500">
          No se encontró la orden de trabajo solicitada.
        </p>
      }
    </section>
  `,
})
export class DetalleOtPage {
  private readonly facade = inject(OtFacadeService);
  private readonly route = inject(ActivatedRoute);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly orden = this.facade.seleccionada;
  protected readonly cargando = this.facade.cargando;
  protected readonly error = this.facade.error;

  protected readonly mostrarDiagnostico = signal(false);

  protected readonly diagnosticoForm = new FormGroup({
    fallaDetectada: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    costoManoObra: new FormControl(0, { nonNullable: true }),
    costoRepuestos: new FormControl(0, { nonNullable: true }),
  });

  protected readonly motivoCtrl = new FormControl('', { nonNullable: true });

  constructor() {
    this.facade.cargarDetalle(this.id);
  }

  protected etiquetaCategoria(orden: OrdenTrabajo): string {
    return ETIQUETA_CATEGORIA[orden.categoriaServicio];
  }

  protected etiquetaEstado(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  protected esTerminal(estado: EstadoOt): boolean {
    return esEstadoTerminal(estado);
  }

  protected asignarTecnico(): void {
    this.facade.asignarTecnico(this.id);
  }

  protected iniciarDesplazamiento(): void {
    this.facade.iniciarDesplazamiento(this.id);
  }

  protected alternarFormularioDiagnostico(): void {
    this.mostrarDiagnostico.update((valor) => !valor);
  }

  protected registrarDiagnostico(): void {
    const valor = this.diagnosticoForm.getRawValue();
    if (!valor.fallaDetectada.trim()) {
      return;
    }
    this.facade.registrarDiagnostico(this.id, {
      fallaDetectada: valor.fallaDetectada.trim(),
      observaciones: valor.observaciones.trim() || undefined,
      costoManoObra: Number(valor.costoManoObra) || 0,
      costoRepuestos: Number(valor.costoRepuestos) || 0,
    });
    this.mostrarDiagnostico.set(false);
  }

  protected aprobarPresupuesto(): void {
    this.facade.aprobarPresupuesto(this.id);
  }

  protected rechazarPresupuesto(): void {
    this.facade.rechazarPresupuesto(this.id, this.motivoCtrl.value.trim() || undefined);
  }

  protected finalizar(): void {
    this.facade.finalizar(this.id);
  }

  protected cancelar(): void {
    const motivo = this.motivoCtrl.value.trim() || 'Cancelación solicitada desde el prototipo';
    this.facade.cancelar(this.id, 'CLIENTE', motivo);
  }

  protected resolverDisputa(conAcuerdo: boolean): void {
    const motivo = this.motivoCtrl.value.trim() || 'Resolución administrativa';
    this.facade.resolverDisputa(this.id, conAcuerdo, motivo);
  }
}
