import { Injectable, computed, inject } from '@angular/core';
import { GoogleMapsLoaderService } from '../service/google-maps-loader';
import { MAPA_ESTILOS } from '../service/mapa-estilos';
import {
  Coordenada,
  EscenaMapa,
  EstiloMarcador,
  MapaInstancia,
  MapaMotor,
  MapaOpciones,
} from './mapa-motor';

/** Colores del marcador por estilo (paleta Stitch: cian técnico, ámbar destino). */
const ICONO_POR_ESTILO: Record<EstiloMarcador, { fill: string; stroke: string; zIndex: number }> = {
  tecnico: { fill: '#22d3ee', stroke: '#04121a', zIndex: 2 },
  destino: { fill: '#f59e0b', stroke: '#1a1204', zIndex: 1 },
};

/**
 * Motor de mapa de Google Maps JavaScript. Es el único archivo del contrato que
 * conoce `google.maps`: el resto de la app habla con `MapaMotor`.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMotor extends MapaMotor {
  private readonly loader = inject(GoogleMapsLoaderService);

  readonly nombre = 'google';
  readonly listo = computed(() => this.loader.isLoaded());
  readonly cargando = computed(() => this.loader.isLoading());

  cargar(): Promise<boolean> {
    return this.loader.init();
  }

  reintentar(): Promise<boolean> {
    return this.loader.reintentar();
  }

  crear(el: HTMLElement, opciones: MapaOpciones): MapaInstancia {
    return new InstanciaGoogle(el, opciones);
  }
}

class InstanciaGoogle implements MapaInstancia {
  private mapa: google.maps.Map | null;
  private readonly marcadores = new Map<string, google.maps.Marker>();
  private readonly lineas = new Map<string, google.maps.Polyline>();

  constructor(el: HTMLElement, opciones: MapaOpciones) {
    this.mapa = new google.maps.Map(el, {
      center: opciones.centro,
      zoom: opciones.zoom,
      minZoom: opciones.zoomMin,
      maxZoom: opciones.zoomMax,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: MAPA_ESTILOS,
      restriction: { latLngBounds: opciones.limites, strictBounds: true },
    });
  }

  actualizar(escena: EscenaMapa): void {
    if (!this.mapa) return;

    const idsMarcadores = new Set(escena.marcadores.map((m) => m.id));
    for (const [id, marcador] of this.marcadores) {
      if (!idsMarcadores.has(id)) {
        marcador.setMap(null);
        this.marcadores.delete(id);
      }
    }
    for (const spec of escena.marcadores) {
      const actual = this.marcadores.get(spec.id);
      if (actual) {
        actual.setPosition(spec.posicion);
        actual.setTitle(spec.titulo);
        continue;
      }
      const estilo = ICONO_POR_ESTILO[spec.estilo];
      const marcador = new google.maps.Marker({
        position: spec.posicion,
        title: spec.titulo,
        zIndex: estilo.zIndex,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: estilo.fill,
          fillOpacity: 1,
          strokeColor: estilo.stroke,
          strokeWeight: 2,
        },
      });
      marcador.setMap(this.mapa);
      this.marcadores.set(spec.id, marcador);
    }

    const lineasValidas = escena.lineas.filter((l) => l.puntos.length >= 2);
    const idsLineas = new Set(lineasValidas.map((l) => l.id));
    for (const [id, linea] of this.lineas) {
      if (!idsLineas.has(id)) {
        linea.setMap(null);
        this.lineas.delete(id);
      }
    }
    for (const spec of lineasValidas) {
      const actual = this.lineas.get(spec.id);
      if (actual) {
        actual.setPath(spec.puntos);
        continue;
      }
      const linea = new google.maps.Polyline({
        path: spec.puntos,
        strokeColor: '#22d3ee',
        strokeOpacity: 0.9,
        strokeWeight: 3,
      });
      linea.setMap(this.mapa);
      this.lineas.set(spec.id, linea);
    }
  }

  ajustarA(puntos: Coordenada[], margenPx: number): void {
    if (!this.mapa || puntos.length === 0) return;
    const limites = new google.maps.LatLngBounds();
    for (const punto of puntos) limites.extend(punto);
    this.mapa.fitBounds(limites, margenPx);
  }

  centrarEn(centro: Coordenada): void {
    this.mapa?.setCenter(centro);
  }

  destruir(): void {
    for (const marcador of this.marcadores.values()) marcador.setMap(null);
    for (const linea of this.lineas.values()) linea.setMap(null);
    this.marcadores.clear();
    this.lineas.clear();
    this.mapa = null;
  }
}
