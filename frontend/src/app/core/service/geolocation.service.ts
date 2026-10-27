import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Point } from '../models/common.models';

/** Códigos de `GeolocationPositionError` (W3C PositionError). */
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/**
 * Causas del GPS traducidas a copy humana. Se comparten con quien consuma el
 * error del watch (p. ej. TecnicoTrackingService): el status/objeto original no
 * siempre llega intacto, pero la causa sí se puede conservar.
 */
const MENSAJES_GPS: Readonly<Record<number, string>> = {
  [PERMISSION_DENIED]: 'Permiso de ubicación denegado. Habilítalo en el navegador para continuar.',
  [POSITION_UNAVAILABLE]: 'La ubicación no está disponible en este momento.',
  [TIMEOUT]: 'Se agotó el tiempo para obtener la ubicación.',
};

/** Fallback para errores sin causa reconocible: no afirma un motivo que no consta. */
const MENSAJE_GPS_DESCONOCIDO = 'No se pudo obtener la ubicación.';

/** Causas ya traducidas, para reconocer el error envuelto en `Error` que emite este servicio. */
const CAUSAS_GPS_CONOCIDAS: readonly string[] = [...Object.values(MENSAJES_GPS), MENSAJE_GPS_DESCONOCIDO];

/**
 * Traduce un `GeolocationPositionError` —o el `Error` ya envuelto que emiten
 * `obtenerPosicion` / `vigilarPosicion`— a copy humana en español.
 */
export function mensajeErrorGeolocation(error: unknown): string {
  const codigo = (error as { code?: unknown } | null)?.code;
  if (typeof codigo === 'number') {
    return MENSAJES_GPS[codigo] ?? MENSAJE_GPS_DESCONOCIDO;
  }
  const mensaje = error instanceof Error ? error.message : '';
  return CAUSAS_GPS_CONOCIDAS.includes(mensaje) ? mensaje : MENSAJE_GPS_DESCONOCIDO;
}

/**
 * Envoltorio SSR-safe de `navigator.geolocation`: expone la posición del
 * dispositivo como `Point` (mismo contrato que el backend) vía Observables.
 */
@Injectable({
  providedIn: 'root',
})
export class GeolocationService {
  readonly disponible = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  obtenerPosicion(opciones?: PositionOptions): Observable<Point> {
    return from(
      new Promise<Point>((resolve, reject) => {
        if (!this.disponible) {
          reject(new Error('La geolocalización no está disponible en este navegador.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(this.aPoint(pos)),
          (err) => reject(new Error(mensajeErrorGeolocation(err))),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000, ...opciones },
        );
      }),
    );
  }

  vigilarPosicion(opciones?: PositionOptions): Observable<Point> {
    return new Observable<Point>((subscriber) => {
      if (!this.disponible) {
        subscriber.error(new Error('La geolocalización no está disponible en este navegador.'));
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => subscriber.next(this.aPoint(pos)),
        (err) => subscriber.error(new Error(mensajeErrorGeolocation(err))),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000, ...opciones },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    });
  }

  private aPoint(pos: GeolocationPosition): Point {
    return { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
  }
}
