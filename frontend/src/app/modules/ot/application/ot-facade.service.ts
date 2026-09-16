import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { ActorOt, esEstadoTerminal } from '../domain/models/estado-ot.model';
import {
  CrearOrdenTrabajoRequest,
  DiagnosticoRequest,
  OrdenTrabajo,
} from '../domain/models/orden-trabajo.model';
import { OtMockService } from '../infrastructure/mock/ot-mock.service';

@Injectable({ providedIn: 'root' })
export class OtFacadeService {
  private readonly servicio = inject(OtMockService);

  private readonly _ordenes = signal<OrdenTrabajo[]>([]);
  private readonly _seleccionada = signal<OrdenTrabajo | null>(null);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly ordenes = this._ordenes.asReadonly();
  readonly seleccionada = this._seleccionada.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();

  readonly total = computed(() => this._ordenes().length);
  readonly activas = computed(
    () => this._ordenes().filter((ot) => !esEstadoTerminal(ot.estado)).length,
  );
  readonly finalizadas = computed(
    () => this._ordenes().filter((ot) => ot.estado === 'FINALIZADA').length,
  );
  readonly enDisputa = computed(
    () => this._ordenes().filter((ot) => ot.estado === 'DISPUTADA').length,
  );

  cargar(): void {
    this._cargando.set(true);
    this._error.set(null);
    this.servicio
      .obtenerTodas()
      .pipe(finalize(() => this._cargando.set(false)))
      .subscribe({
        next: (ordenes) => this._ordenes.set(ordenes),
        error: (error: unknown) => this._error.set(this.mensaje(error)),
      });
  }

  cargarDetalle(id: string): void {
    this._cargando.set(true);
    this._error.set(null);
    this.servicio
      .obtenerPorId(id)
      .pipe(finalize(() => this._cargando.set(false)))
      .subscribe({
        next: (orden) => this._seleccionada.set(orden),
        error: (error: unknown) => {
          this._seleccionada.set(null);
          this._error.set(this.mensaje(error));
        },
      });
  }

  crear(request: CrearOrdenTrabajoRequest): void {
    this.ejecutar(this.servicio.crear(request));
  }

  asignarTecnico(id: string): void {
    this.ejecutar(this.servicio.asignarTecnico(id));
  }

  iniciarDesplazamiento(id: string): void {
    this.ejecutar(this.servicio.iniciarDesplazamiento(id));
  }

  registrarDiagnostico(id: string, request: DiagnosticoRequest): void {
    this.ejecutar(this.servicio.registrarDiagnostico(id, request));
  }

  aprobarPresupuesto(id: string): void {
    this.ejecutar(this.servicio.aprobarPresupuesto(id));
  }

  rechazarPresupuesto(id: string, motivo?: string): void {
    this.ejecutar(this.servicio.rechazarPresupuesto(id, motivo));
  }

  finalizar(id: string): void {
    this.ejecutar(this.servicio.finalizar(id));
  }

  cancelar(id: string, actor: ActorOt, motivo: string): void {
    this.ejecutar(this.servicio.cancelar(id, actor, motivo));
  }

  resolverDisputa(id: string, conAcuerdo: boolean, motivo: string): void {
    this.ejecutar(this.servicio.resolverDisputa(id, conAcuerdo, motivo));
  }

  private ejecutar(accion: Observable<OrdenTrabajo>): void {
    this._cargando.set(true);
    this._error.set(null);
    accion.pipe(finalize(() => this._cargando.set(false))).subscribe({
      next: (orden) => this.sincronizar(orden),
      error: (error: unknown) => this._error.set(this.mensaje(error)),
    });
  }

  private sincronizar(orden: OrdenTrabajo): void {
    const existe = this._ordenes().some((ot) => ot.id === orden.id);
    if (existe) {
      this._ordenes.update((lista) => lista.map((ot) => (ot.id === orden.id ? orden : ot)));
    } else {
      this._ordenes.update((lista) => [orden, ...lista]);
    }
    if (this._seleccionada()?.id === orden.id) {
      this._seleccionada.set(orden);
    }
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
  }
}
