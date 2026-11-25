import type { Coordenada } from './mapa-motor';

/**
 * Decodifica un polyline de precisión 5 (el formato que devuelve el backend y
 * que también emiten Google Directions y Mapbox Directions con
 * `geometries=polyline`). JS puro: no necesita ningún SDK de mapas.
 *
 * Devuelve `null` si la cadena es vacía, está truncada o da menos de 2 puntos:
 * el llamador dibuja entonces la línea recta y el mapa nunca se rompe.
 */
export function decodificarPolyline(codificada: string | null | undefined): Coordenada[] | null {
  if (!codificada) return null;

  const puntos: Coordenada[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  const leerValor = (): number | null => {
    let resultado = 0;
    let desplazamiento = 0;
    let byte: number;
    do {
      if (indice >= codificada.length) return null;
      byte = codificada.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (byte >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };

  while (indice < codificada.length) {
    const deltaLat = leerValor();
    const deltaLng = leerValor();
    if (deltaLat === null || deltaLng === null) return null;
    lat += deltaLat;
    lng += deltaLng;
    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return puntos.length >= 2 ? puntos : null;
}
