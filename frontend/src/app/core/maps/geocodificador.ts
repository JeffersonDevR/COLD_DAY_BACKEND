import type { Observable } from 'rxjs';
import type { DireccionApiResponse, SugerenciaApiResponse } from '../models/backend.dto';
import type { Point } from '../models/common.models';

/**
 * Geocodificación y autocompletado del lado del cliente. Es el respaldo de
 * `MapsApi` cuando el proxy `/api/maps` no responde. Cada proveedor de mapas
 * trae su implementación y devuelve los mismos contratos del backend.
 */
export abstract class GeocodificadorCliente {
  abstract autocompletar(input: string, sesgo?: Point): Observable<SugerenciaApiResponse[]>;
  abstract geocodificar(direccion: string): Observable<DireccionApiResponse>;
  abstract inversa(lat: number, lng: number): Observable<DireccionApiResponse>;
}
