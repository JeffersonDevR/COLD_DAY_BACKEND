import { Injectable, inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { MapsApi } from './maps-api';
import { distanciaHaversineKm } from './distancia-local';
import { EstadoOt, Point } from '../models/common.models';

/**
 * OT states in which the assigned technician should be moving. The tracking
 * screen uses the same list to decide whether the map is worth showing.
 */
export const ESTADOS_TECNICO_EN_MOVIMIENTO: readonly EstadoOt[] = [
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
];

/** Minimum time between two Directions requests, whatever the poll cadence. */
export const INTERVALO_MIN_RUTA_MS = 60_000;

/** Displacement (metres) that makes an early request worth paying for. */
export const DISTANCIA_MIN_RUTA_M = 200;

/** What the caller knows that the guard needs to decide whether to spend. */
export interface ContextoRuta {
  /** `true` while the browser tab is visible. */
  visible: boolean;
  /** Current OT state; `undefined` when the OT is not loaded yet. */
  estado: EstadoOt | undefined;
}

/**
 * Cost guard for the real street route.
 *
 * The tracking screen polls the technician position every 15 s. Asking the
 * backend for a Directions route on every tick would be 4 paid requests per
 * minute per client watching the screen, and Google does not change its answer
 * in 15 s for a technician who has barely moved. So a request is only sent when
 * ALL of these hold:
 *
 * - the tab is visible (nobody is looking, nobody pays),
 * - the OT is in a state where the technician is moving,
 * - no request was made yet for this screen, OR the 60 s window elapsed, OR the
 *   technician moved more than 200 m since the last requested position.
 *
 * A request that ends without geometry (404/502/503 → `null`) still counts as a
 * request: otherwise a Google outage would turn every tick into a paid attempt.
 *
 * The decoded route lives here (`rutaCodificada`) so the page only forwards it
 * to the map; the in-flight request dies with `detener()`.
 */
@Injectable()
export class RutaSeguimientoService {
  private readonly mapsApi = inject(MapsApi);

  /** Encoded route of the last accepted request; `null` means "straight line". */
  readonly rutaCodificada = signal<string | null>(null);

  /** Timestamp of the last accepted request; `null` = none yet on this screen. */
  private ultimaPeticionEn: number | null = null;

  /** Position used by the last accepted request. */
  private posicionUltimaPeticion: Point | null = null;

  private enVuelo = false;
  private peticion: Subscription | null = null;

  /**
   * Asks for the route if the guard allows it. Returns `true` when a request
   * was actually issued. Without position or destination nothing is requested:
   * the map has nothing to draw anyway.
   */
  actualizar(origen: Point | null, destino: Point | null, contexto: ContextoRuta): boolean {
    if (!origen || !destino) return false;
    if (!this.procede(origen, contexto)) return false;

    this.ultimaPeticionEn = Date.now();
    this.posicionUltimaPeticion = origen;
    this.enVuelo = true;
    this.peticion?.unsubscribe();
    this.peticion = this.mapsApi
      .ruta(origen, destino)
      .pipe(finalize(() => (this.enVuelo = false)))
      .subscribe({
        // `polyline === ""` means Google answered without geometry: the map
        // falls back to the straight line instead of drawing nothing.
        next: (ruta) => this.rutaCodificada.set(ruta?.polyline || null),
        error: () => this.rutaCodificada.set(null),
      });
    return true;
  }

  /** Cancels the in-flight request (page destroy: no request outlives the screen). */
  detener(): void {
    this.peticion?.unsubscribe();
    this.peticion = null;
    this.enVuelo = false;
  }

  private procede(origen: Point, contexto: ContextoRuta): boolean {
    if (!contexto.visible) return false;
    if (!contexto.estado || !ESTADOS_TECNICO_EN_MOVIMIENTO.includes(contexto.estado)) return false;
    // One paid request at a time: the answer of the previous one is still on
    // its way and would supersede this position anyway.
    if (this.enVuelo) return false;
    if (this.ultimaPeticionEn === null || !this.posicionUltimaPeticion) return true;
    if (Date.now() - this.ultimaPeticionEn >= INTERVALO_MIN_RUTA_MS) return true;
    return (
      distanciaHaversineKm(this.posicionUltimaPeticion, origen) * 1000 > DISTANCIA_MIN_RUTA_M
    );
  }
}
