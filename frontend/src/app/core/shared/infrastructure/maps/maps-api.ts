import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiConfig } from '../api/api.config';
import {
  DireccionApiResponse,
  DistanciaApiResponse,
  EstadoMapsApiResponse,
  SugerenciaApiResponse,
} from '../api/backend.dto';
import { Point } from '../../domain/models/common.models';

/**
 * Fachada del proxy seguro /api/maps del backend (Google Maps Platform).
 *
 * El backend guarda la server key; el frontend solo pide geocodificación,
 * autocompletado y distancias. En modo mock devuelve datos sembrados de Cúcuta
 * para que la UI funcione sin backend ni cuota de Google.
 */
@Injectable({
  providedIn: 'root',
})
export class MapsApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);

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
    return this.http.post<DireccionApiResponse>(this.apiConfig.url('/maps/geocode'), { direccion });
  }

  inversa(lat: number, lng: number): Observable<DireccionApiResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.direccionMock(`Coordenadas ${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng)).pipe(delay(300));
    }
    const params = new HttpParams().set('lat', lat).set('lng', lng);
    return this.http.get<DireccionApiResponse>(this.apiConfig.url('/maps/inversa'), { params });
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
    return this.http.get<SugerenciaApiResponse[]>(this.apiConfig.url('/maps/autocompletar'), { params });
  }

  distancia(origen: Point, destino: Point): Observable<DistanciaApiResponse> {
    if (this.apiConfig.useMocks()) {
      const km = this.haversineKm(origen, destino);
      const min = Math.round((km / 25) * 60);
      return of({
        distanciaKm: Math.round(km * 100) / 100,
        duracionMin: min,
        distanciaTexto: `${km.toFixed(1)} km`,
        duracionTexto: `${min} min`,
      }).pipe(delay(250));
    }
    return this.http.post<DistanciaApiResponse>(this.apiConfig.url('/maps/distancia'), {
      origenLat: origen.latitud,
      origenLng: origen.longitud,
      destinoLat: destino.latitud,
      destinoLng: destino.longitud,
    });
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

  private haversineKm(a: Point, b: Point): number {
    const radioTierraKm = 6371;
    const dLat = ((b.latitud - a.latitud) * Math.PI) / 180;
    const dLng = ((b.longitud - a.longitud) * Math.PI) / 180;
    const lat1 = (a.latitud * Math.PI) / 180;
    const lat2 = (b.latitud * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radioTierraKm * Math.asin(Math.sqrt(h));
  }
}
