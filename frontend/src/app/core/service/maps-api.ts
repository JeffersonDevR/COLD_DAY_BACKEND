import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { delay, switchMap } from 'rxjs/operators';
import { ApiConfig } from './api.config';
import { MapsGeocoderCliente } from './maps-geocoder-cliente';
import {
  DireccionApiResponse,
  EstadoMapsApiResponse,
  SugerenciaApiResponse,
} from '../models/backend.dto';
import { Point } from '../models/common.models';

/**
 * Fachada del proxy seguro /api/maps del backend (Google Maps Platform).
 *
 * El backend guarda la server key; el frontend solo pide geocodificación y
 * autocompletado. En modo mock devuelve datos sembrados de Cúcuta para que la
 * UI funcione sin backend ni cuota de Google.
 *
 * NO expone distancias: el cálculo de ruta se hace en el navegador
 * (core/service/distancia-local) para no gastar cuota de Google en cada tick.
 */
@Injectable({
  providedIn: 'root',
})
export class MapsApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly geocoder = inject(MapsGeocoderCliente);

  estado(): Observable<EstadoMapsApiResponse> {
    if (this.apiConfig.useMocks()) {
      return of({ enabled: true, configured: true, language: 'es', region: 'CO' }).pipe(delay(150));
    }
    return this.http.get<EstadoMapsApiResponse>(this.apiConfig.url('/maps/estado'));
  }

  geocodificar(direccion: string): Observable<DireccionApiResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.direccionMock(direccion)).pipe(delay(350));
    }
    // Proxy del backend como vía principal; si no está disponible (server key
    // ausente, 401/503/404), se geocodifica en el navegador con la key de navegador.
    return this.http
      .post<DireccionApiResponse>(this.apiConfig.url('/maps/geocode'), { direccion })
      .pipe(catchError(() => this.geocoder.geocodificar(direccion)));
  }

  inversa(lat: number, lng: number): Observable<DireccionApiResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.direccionMock(`Coordenadas ${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng)).pipe(delay(300));
    }
    const params = new HttpParams().set('lat', lat).set('lng', lng);
    return this.http
      .get<DireccionApiResponse>(this.apiConfig.url('/maps/inversa'), { params })
      .pipe(catchError(() => this.geocoder.inversa(lat, lng)));
  }

  autocompletar(input: string, sesgo?: Point): Observable<SugerenciaApiResponse[]> {
    if (this.apiConfig.useMocks()) {
      const query = input.trim().toLowerCase();
      const sugerencias = [
        { descripcion: 'Calle 15 # 3E-28, Los Caobos, Cúcuta', placeId: 'mock-caobos' },
        { descripcion: 'Avenida 4 # 11-20, La Riviera, Cúcuta', placeId: 'mock-riviera' },
        { descripcion: 'Calle 10 # 5-45, Guaimaral, Cúcuta', placeId: 'mock-guaimaral' },
        { descripcion: 'Carrera 8 # 12-10, Centro, Cúcuta', placeId: 'mock-centro' },
        { descripcion: 'Calle 17 # 8-30, Quinta Oriental, Cúcuta', placeId: 'mock-quinta' },
      ].filter((s) => s.descripcion.toLowerCase().includes(query));
      return of(sugerencias).pipe(delay(180));
    }
    let params = new HttpParams().set('input', input);
    if (sesgo) {
      params = params.set('lat', sesgo.latitud).set('lng', sesgo.longitud);
    }
    // Fallback: si el backend no trae sugerencias (p. ej. sin server key, que hoy
    // devuelve lista vacía), se autocompleta en el navegador con la key de navegador.
    return this.http
      .get<SugerenciaApiResponse[]>(this.apiConfig.url('/maps/autocompletar'), { params })
      .pipe(switchMap((lista) => (lista.length ? of(lista) : this.geocoder.autocompletar(input, sesgo))));
  }

  private direccionMock(direccion: string, lat = 7.8872, lng = -72.4951): DireccionApiResponse {
    return {
      direccionFormateada: direccion.trim() || 'Dirección sin nombre, Cúcuta',
      latitud: lat,
      longitud: lng,
      placeId: `mock-${Math.abs(this.hashCode(direccion))}`,
    };
  }

  private hashCode(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + (value.codePointAt(i) ?? 0)) % 2147483647;
    }
    return hash;
  }
}
