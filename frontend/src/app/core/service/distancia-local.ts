import { Point } from '../models/common.models';

/**
 * Distancia y ETA calculadas en el navegador (haversine), sin llamar a Google.
 *
 * El seguimiento del cliente sondea la posición del técnico cada 15 s. Pedirle
 * la distancia a Distance Matrix en cada tick quemaba cuota de Google (4
 * llamadas por minuto y por cliente que miraba la pantalla). Con este cálculo
 * local la ruta se estima en el cliente y el tick no cuesta nada.
 */

/** Radio medio de la Tierra en km. */
const RADIO_TIERRA_KM = 6371;

/** Velocidad media de referencia (km/h) para trayectos urbanos en Cúcuta. */
export const VELOCIDAD_MEDIA_KMH = 25;

/**
 * Distancia en línea recta entre dos puntos (haversine), en km.
 * Es la cota inferior de la distancia real por calle: nunca la supera.
 */
export function distanciaHaversineKm(origen: Point, destino: Point): number {
  const dLat = ((destino.latitud - origen.latitud) * Math.PI) / 180;
  const dLng = ((destino.longitud - origen.longitud) * Math.PI) / 180;
  const lat1 = (origen.latitud * Math.PI) / 180;
  const lat2 = (destino.latitud * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

/**
 * Ruta estimada en el navegador: distancia en línea recta y ETA con la
 * velocidad media de referencia. La ETA NO conoce el tráfico ni las calles:
 * es el tiempo mínimo teórico del trayecto, no el tiempo real de la calle.
 */
export function rutaLocal(
  origen: Point,
  destino: Point,
): { distanciaKm: number; duracionMin: number } {
  const km = distanciaHaversineKm(origen, destino);
  return {
    distanciaKm: Math.round(km * 100) / 100,
    duracionMin: Math.round((km / VELOCIDAD_MEDIA_KMH) * 60),
  };
}
