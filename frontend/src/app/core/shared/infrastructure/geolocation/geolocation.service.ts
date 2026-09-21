import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Point } from '../../domain/models/common.models';

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
          (err) => reject(new Error(this.mensajeError(err))),
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
        (err) => subscriber.error(new Error(this.mensajeError(err))),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000, ...opciones },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    });
  }

  private aPoint(pos: GeolocationPosition): Point {
    return { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
  }

  private mensajeError(err: GeolocationPositionError): string {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return 'Permiso de ubicación denegado. Habilítalo en el navegador para continuar.';
      case err.POSITION_UNAVAILABLE:
        return 'La ubicación no está disponible en este momento.';
      case err.TIMEOUT:
        return 'Se agotó el tiempo para obtener la ubicación.';
      default:
        return 'No se pudo obtener la ubicación.';
    }
  }
}
