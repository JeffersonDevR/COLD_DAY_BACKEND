import { InjectionToken, inject } from '@angular/core';
import { MapsGeocoderCliente } from '../service/maps-geocoder-cliente';
import { GeocodificadorCliente } from './geocodificador';

/**
 * Geocodificador del cliente que usa la app. Hoy es el de Google; para otro
 * proveedor se cambia aquí (o se elige por `MapaConfigService.proveedor`).
 */
export const GEOCODIFICADOR_CLIENTE = new InjectionToken<GeocodificadorCliente>('GEOCODIFICADOR_CLIENTE', {
  providedIn: 'root',
  factory: () => inject(MapsGeocoderCliente),
});
