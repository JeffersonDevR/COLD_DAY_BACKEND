import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from './api.config';

/**
 * Configuración del mapa que publica el backend (GET /api/config/maps).
 *
 * El backend es la única fuente de verdad del centro, los límites del área
 * metropolitana, el zoom y la escala de radios: el front ya no lleva sus propias
 * copias de esos números. Este servicio la pide una sola vez al arranque y la
 * expone como señales, de modo que los mapas se re-ajustan solos si el backend
 * cambia los valores.
 *
 * Los valores por defecto de abajo son el respaldo para cuando no hay backend
 * (modo mock, sin conexión o backend caído): son los mismos que declara
 * `app.maps.*` en el backend, no una fuente paralela.
 */

/** Centro del mapa (misma forma que `google.maps.LatLngLiteral`). */
export interface MapaCentro {
  lat: number;
  lng: number;
}

/** Límites del mapa (misma forma que `google.maps.LatLngBoundsLiteral`). */
export interface MapaBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Configuración completa del mapa. */
export interface MapaConfig {
  centro: MapaCentro;
  bounds: MapaBounds;
  zoom: number;
  radioInicialKm: number;
  radioMaxKm: number;
  radioPasoKm: number;
}

/** Respuesta del backend; cada bloque puede venir incompleto o ausente. */
interface ConfigMapaApiResponse {
  apiKey?: string | null;
  centro?: Partial<MapaCentro>;
  bounds?: Partial<MapaBounds>;
  zoom?: number;
  radioInicialKm?: number;
  radioMaxKm?: number;
  radioPasoKm?: number;
}

/**
 * Ciudad única de operación del servicio. El backend publica el centro y los
 * radios del área metropolitana, pero no el nombre de la ciudad: este literal es
 * el default editable del alta rápida de perfil de cliente.
 */
export const CIUDAD_OPERACION = 'Cúcuta';

/** Respaldo: los mismos valores por defecto que declara el backend. */
const CONFIG_POR_DEFECTO: MapaConfig = {
  centro: { lat: 7.8939, lng: -72.5078 },
  bounds: { north: 8.08, south: 7.76, east: -72.41, west: -72.6 },
  zoom: 13,
  radioInicialKm: 10,
  radioMaxKm: 25,
  radioPasoKm: 5,
};

@Injectable({
  providedIn: 'root',
})
export class MapaConfigService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);

  private readonly config = signal<MapaConfig>(CONFIG_POR_DEFECTO);
  private carga: Promise<MapaConfig> | null = null;

  /** Configuración vigente (señal con la que se recalculan los mapas). */
  readonly centro = computed(() => this.config().centro);
  readonly bounds = computed(() => this.config().bounds);
  readonly zoom = computed(() => this.config().zoom);
  readonly radioInicialKm = computed(() => this.config().radioInicialKm);
  readonly radioMaxKm = computed(() => this.config().radioMaxKm);
  readonly radioPasoKm = computed(() => this.config().radioPasoKm);

  /**
   * Browser key de Google Maps, si el backend la publica. Es la única credencial
   * que el front puede leer (viene restringida por HTTP referrer).
   */
  readonly apiKey = signal<string>('');

  /**
   * Pide la configuración al backend UNA sola vez (las llamadas siguientes
   * reutilizan la misma promesa). Si el backend no responde, se conserva el
   * respaldo: el mapa sigue funcionando con los valores por defecto.
   */
  async cargar(): Promise<MapaConfig> {
    if (!this.carga) {
      this.carga = this.cargarDesdeBackend();
    }
    return this.carga;
  }

  private async cargarDesdeBackend(): Promise<MapaConfig> {
    try {
      const respuesta = await firstValueFrom(
        this.http.get<ConfigMapaApiResponse>(this.apiConfig.url('/config/maps')),
      );
      this.config.set(normalizar(respuesta));
      const key = (respuesta?.apiKey ?? '').trim();
      if (key) {
        this.apiKey.set(key);
      }
    } catch {
      // Sin backend (mock, offline o caído): se sigue con el respaldo.
    }
    return this.config();
  }
}

/** Combina la respuesta del backend con el respaldo: lo que no llega, se conserva. */
function normalizar(respuesta: ConfigMapaApiResponse | null | undefined): MapaConfig {
  const porDefecto = CONFIG_POR_DEFECTO;
  return {
    centro: {
      lat: respuesta?.centro?.lat ?? porDefecto.centro.lat,
      lng: respuesta?.centro?.lng ?? porDefecto.centro.lng,
    },
    bounds: {
      north: respuesta?.bounds?.north ?? porDefecto.bounds.north,
      south: respuesta?.bounds?.south ?? porDefecto.bounds.south,
      east: respuesta?.bounds?.east ?? porDefecto.bounds.east,
      west: respuesta?.bounds?.west ?? porDefecto.bounds.west,
    },
    zoom: respuesta?.zoom ?? porDefecto.zoom,
    radioInicialKm: respuesta?.radioInicialKm ?? porDefecto.radioInicialKm,
    radioMaxKm: respuesta?.radioMaxKm ?? porDefecto.radioMaxKm,
    radioPasoKm: respuesta?.radioPasoKm ?? porDefecto.radioPasoKm,
  };
}
