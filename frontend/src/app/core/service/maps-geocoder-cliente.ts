import { Injectable, inject } from '@angular/core';
import { from, Observable, of, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { GoogleMapsLoaderService } from './google-maps-loader';
import { DireccionApiResponse, SugerenciaApiResponse } from '../models/backend.dto';
import { Point } from '../models/common.models';

/**
 * Geocodificación 100% en el navegador usando la MISMA key de navegador con la
 * que ya se renderiza el mapa (Google Maps JavaScript API).
 *
 * Existe como FALLBACK de MapsApi: cuando el proxy /api/maps no está disponible
 * (server key ausente, backend caído, 401/503), el resolver de direcciones del
 * formulario sigue funcionando sin depender del backend. Devuelve exactamente
 * los mismos shapes (DireccionApiResponse / SugerenciaApiResponse[]) para que
 * sea intercambiable con el proxy.
 *
 * Requiere que la key de navegador tenga habilitadas, además de Maps JavaScript
 * API: Geocoding API y Places API (restricción por referrer HTTP).
 */
@Injectable({
  providedIn: 'root',
})
export class MapsGeocoderCliente {
  private readonly mapsLoader = inject(GoogleMapsLoaderService);

  /** Sesgo de ~25 km alrededor de Cúcuta para priorizar sugerencias locales. */
  private static readonly RADIO_SESGO_M = 25_000;

  autocompletar(input: string, sesgo?: Point): Observable<SugerenciaApiResponse[]> {
    return this.listo().pipe(
      switchMap(
        () =>
          new Observable<SugerenciaApiResponse[]>((sub) => {
            const solicitud: google.maps.places.AutocompletionRequest = {
              input,
              componentRestrictions: { country: 'co' },
              types: ['address'],
            };
            if (sesgo) {
              solicitud.location = new google.maps.LatLng(sesgo.latitud, sesgo.longitud);
              solicitud.radius = MapsGeocoderCliente.RADIO_SESGO_M;
            }
            new google.maps.places.AutocompleteService().getPlacePredictions(
              solicitud,
              (predicciones, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && predicciones?.length) {
                  sub.next(
                    predicciones.map((p) => ({ descripcion: p.description, placeId: p.place_id })),
                  );
                } else {
                  sub.next([]);
                }
                sub.complete();
              },
            );
          }),
      ),
    );
  }

  geocodificar(direccion: string): Observable<DireccionApiResponse> {
    return this.listo().pipe(
      switchMap(() =>
        this.geocode({ address: direccion, componentRestrictions: { country: 'co' } }),
      ),
    );
  }

  inversa(lat: number, lng: number): Observable<DireccionApiResponse> {
    return this.listo().pipe(switchMap(() => this.geocode({ location: { lat, lng } })));
  }

  private geocode(solicitud: google.maps.GeocoderRequest): Observable<DireccionApiResponse> {
    return new Observable<DireccionApiResponse>((sub) => {
      new google.maps.Geocoder().geocode(solicitud, (resultados, status) => {
        const primero = resultados?.[0];
        if (status === google.maps.GeocoderStatus.OK && primero) {
          sub.next({
            direccionFormateada: primero.formatted_address,
            latitud: primero.geometry.location.lat(),
            longitud: primero.geometry.location.lng(),
            placeId: primero.place_id,
          });
          sub.complete();
        } else {
          sub.error(new Error(`geocode ${status}`));
        }
      });
    });
  }

  /**
   * Espera a que la API de Google quede operativa. `init()` es single-flight e
   * idempotente; si no logra cargar (sin key, red, etc.) emite error para que el
   * fallback de MapsApi se detenga con una señal honesta en vez de colgarse.
   */
  private listo(): Observable<void> {
    return from(this.mapsLoader.init()).pipe(
      switchMap((ok) =>
        ok ? of(void 0) : throwError(() => new Error(this.mapsLoader.loadError() ?? 'Google Maps no disponible')),
      ),
    );
  }
}
