import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, Observable, of, tap } from 'rxjs';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { refrescarConActividadAdmin } from '../../core/service/admin-actividad-refresco';
import { SseService, TipoActividadAdmin } from '../../core/service/sse.service';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { LiquidacionResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';
import { CargaError } from '../../shared/carga-error/carga-error';

/** Actividad administrativa que cambia esta pantalla. */
const TIPOS_CONSIGNACION: readonly TipoActividadAdmin[] = [
  'COMPROBANTE_CARGADO',
  'LIQUIDACION_REGISTRADA',
  'LIQUIDACION_APROBADA',
  'LIQUIDACION_RECHAZADA',
];

@Component({
  selector: 'app-consignaciones-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, CargaError],
  templateUrl: './consignaciones-admin-page.html'
})
export class ConsignacionesAdminPage {
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);
  /** Canal admin; `null` sin backend SSE (mock/SSR/specs): la pantalla sigue igual. */
  private readonly sse = inject(SseService, { optional: true });
  private readonly destruir = inject(DestroyRef);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly liquidaciones = signal<LiquidacionResponse[]>([]);
  readonly tecnicos = signal<TecnicoResponse[]>([]);

  /**
   * `true` cuando no se pudo leer el listado de técnicos: el contador de
   * bloqueados es desconocido, no cero, y la tarjeta lo dice así.
   */
  readonly tecnicosDesconocidos = signal<boolean>(false);

  readonly enVerificacion = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'EN_VERIFICACION')
  );

  readonly tecnicosBloqueados = computed(() =>
    this.tecnicos().filter(t => t.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION')
  );

  readonly totalComisionesAprobadas = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'APROBADA').reduce((acc, l) => acc + l.comision, 0)
  );

  readonly liqARechazar = signal<LiquidacionResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  /** Carga silenciosa: si falla, la pantalla lo dice y ofrece reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  /**
   * `true` mientras no conocemos las liquidaciones (cargando o carga fallida):
   * los totales del resumen son desconocidos, no cero, y las tarjetas lo dicen así.
   */
  readonly resumenDesconocido = computed(() => this.cargando() || this.errorCarga());

  constructor() {
    this.cargarDatos();
    // Comprobantes y liquidaciones son esta pantalla; una validación de técnico
    // o una disputa no la cambian.
    refrescarConActividadAdmin({
      sse: this.sse,
      destruir: this.destruir,
      tipos: TIPOS_CONSIGNACION,
      recargar: () => this.recargarDatos(),
    });
  }

  cargarDatos(): void {
    this.recargarDatos().subscribe();
  }

  /** Carga liquidaciones y técnicos, y expone el final de ambas. */
  private recargarDatos(): Observable<unknown> {
    this.cargando.set(true);
    this.errorCarga.set(false);
    const liquidaciones$ = this.liquidacionApi.getTodasLiquidaciones().pipe(
      tap((liquidaciones) => this.liquidaciones.set(liquidaciones)),
      catchError(() => {
        this.liquidaciones.set([]);
        this.errorCarga.set(true);
        return of(null);
      }),
      finalize(() => this.cargando.set(false)),
    );
    const tecnicos$ = this.tecnicosApi.getTecnicos().pipe(
      tap((tecnicos) => {
        this.tecnicos.set(tecnicos);
        this.tecnicosDesconocidos.set(false);
      }),
      // Los técnicos solo alimentan el contador de bloqueados: su fallo no
      // invalida la lista de liquidaciones ni duplica el aviso, pero tampoco
      // autoriza a reportar "0 bloqueados" como si fuera un hecho.
      catchError(() => {
        this.tecnicos.set([]);
        this.tecnicosDesconocidos.set(true);
        return of(null);
      }),
    );
    return forkJoin([liquidaciones$, tecnicos$]);
  }

  aprobar(liq: LiquidacionResponse): void {
    this.liquidacionApi.aprobarLiquidacion(liq.id).subscribe({
      next: () => {
        this.toast.success('Conciliación Aprobada', `Comisión acreditada. El técnico ${liq.tecnicoNombre ?? ''} ha sido habilitado.`);
        this.cargarDatos();
      },
      // Sin recargar: la fila sigue en pantalla y el admin ve por qué no se aprobó.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo aprobar la conciliación', err);
      },
    });
  }

  abrirRechazo(liq: LiquidacionResponse): void {
    this.liqARechazar.set(liq);
  }

  confirmarRechazo(): void {
    const liq = this.liqARechazar();
    if (!liq || this.motivoCtrl.invalid) return;

    this.liquidacionApi.rechazarLiquidacion(liq.id, this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Liquidación Rechazada', 'Se notificó al técnico para que suba un comprobante válido.');
        this.liqARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargarDatos();
      },
      // El modal queda abierto y el motivo escrito intacto para que el admin reintente.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo rechazar la liquidación', err);
      },
    });
  }
}
