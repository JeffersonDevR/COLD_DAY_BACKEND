import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { GoogleMap, MapMarker, MapPolyline } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';
import { MapaConfigService } from '../../core/service/mapa-config.service';
import { rutaLocal } from '../../core/service/distancia-local';
import { Point } from '../../core/models/common.models';
import {
  MAPA_ESTILOS,
  MARCADOR_CLIENTE_OPCIONES,
  MARCADOR_TECNICO_OPCIONES,
} from '../mapa-radar/mapa-radar';

/**
 * Mapa de seguimiento: dónde está el técnico y hacia dónde va.
 *
 * Es la segunda mitad del radar: el radar muestra quién está disponible
 * alrededor del cliente; este mapa muestra al técnico que ya fue asignado,
 * moviéndose hacia el punto de servicio.
 *
 * NO llama a la API de Google Maps: la posición llega del sondeo que ya hace
 * la página (`GET /api/ot/{id}/tecnico-ubicacion`), el destino ya está en la
 * OT y la "ruta" es la línea recta entre los dos (sin Directions API). Todo
 * lo que se dibuja es local.
 *
 * Es progresivo: si el script de Google no carga, el mapa no aparece, pero el
 * texto con la distancia y la ETA sigue visible (la información nunca vive
 * solo dentro del mapa).
 */
@Component({
  selector: 'app-mapa-seguimiento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, GoogleMap, MapMarker, MapPolyline],
  templateUrl: './mapa-seguimiento.html',
})
export class MapaSeguimiento implements OnInit {
  readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly mapaConfig = inject(MapaConfigService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Última posición conocida del técnico; `null` si todavía no reportó. */
  readonly posicionTecnico = input<Point | null>(null);
  /** Punto de servicio (destino) de la OT. */
  readonly destino = input<Point | null>(null);
  /** Nombre legible del destino (barrio o dirección corta). */
  readonly destinoNombre = input<string>('Punto de servicio');
  /** Nombre del técnico asignado. */
  readonly tecnicoNombre = input<string>('El técnico');
  /**
   * ¿El técnico ya llegó al punto de servicio? Lo sabe la página (la OT trae
   * `llegadaEn`) y el mapa lo necesita para no seguir diciendo "En camino:".
   */
  readonly llegada = input<boolean>(false);

  /** Posición del marcador del técnico; `null` sin posición (no hay pin). */
  readonly posicionMarcador = computed<google.maps.LatLngLiteral | null>(() => {
    const punto = this.posicionTecnico();
    return punto ? { lat: punto.latitud, lng: punto.longitud } : null;
  });

  /** Posición del marcador del destino. */
  readonly destinoMarcador = computed<google.maps.LatLngLiteral | null>(() => {
    const punto = this.destino();
    return punto ? { lat: punto.latitud, lng: punto.longitud } : null;
  });

  /**
   * La "ruta": línea recta del técnico al destino (2 puntos). Sin posición
   * del técnico no hay línea: mejor un mapa vacío que una ruta inventada.
   */
  readonly ruta = computed<google.maps.LatLngLiteral[]>(() => {
    const tecnico = this.posicionMarcador();
    const destino = this.destinoMarcador();
    return tecnico && destino ? [tecnico, destino] : [];
  });

  /**
   * El mapa solo se dibuja cuando hay posición del técnico: sin posición no
   * hay marcador (técnico ni destino) ni ruta, y no se inventa nada.
   */
  readonly mostrarMapa = computed<boolean>(() => this.posicionMarcador() !== null);

  /**
   * Centro del mapa: el punto medio de la ruta para que se vean el técnico y
   * el destino a la vez; si falta uno, el que exista; si no hay ninguno, el
   * centro que publica el backend.
   */
  readonly centro = computed<google.maps.LatLngLiteral>(() => {
    const tecnico = this.posicionMarcador();
    const destino = this.destinoMarcador();
    if (tecnico && destino) {
      return {
        lat: (tecnico.lat + destino.lat) / 2,
        lng: (tecnico.lng + destino.lng) / 2,
      };
    }
    const uno = tecnico ?? destino;
    if (uno) return uno;
    const centro = this.mapaConfig.centro();
    return { lat: centro.lat, lng: centro.lng };
  });

  /** Zoom del backend (nunca una copia local del número). */
  readonly zoomNivel = computed<number>(() => this.mapaConfig.zoom());

  readonly mapOptions = computed<google.maps.MapOptions>(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    minZoom: this.mapaConfig.zoom() - 2,
    maxZoom: 18,
    // Restricción geográfica estricta: no se sale del área metropolitana.
    restriction: {
      latLngBounds: this.mapaConfig.bounds(),
      strictBounds: true,
    },
    internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    styles: MAPA_ESTILOS,
  }));

  /** Marcadores: los mismos del radar (verde el técnico, azul el destino). */
  readonly marcadorTecnicoOpciones = MARCADOR_TECNICO_OPCIONES;
  readonly marcadorDestinoOpciones = MARCADOR_CLIENTE_OPCIONES;

  /** La línea recta de la ruta. */
  readonly rutaOpciones: google.maps.PolylineOptions = {
    strokeColor: '#38bdf8',
    strokeOpacity: 0.9,
    strokeWeight: 3,
  };

  /**
   * Distancia en línea recta calculada en el navegador (haversine, el mismo
   * módulo que usa la página). `null` si falta alguna de las dos posiciones:
   * sin dato no hay número.
   */
  readonly distanciaKm = computed<number | null>(() => {
    const tecnico = this.posicionTecnico();
    const destino = this.destino();
    if (!tecnico || !destino) return null;
    return rutaLocal(tecnico, destino).distanciaKm;
  });

  ngOnInit(): void {
    // El loader es único en toda la app: el script no se carga dos veces.
    if (this.isBrowser) {
      this.mapsLoader.init();
    }
  }
}
