import type { Signal } from '@angular/core';

/**
 * Contrato propio del mapa. Las pantallas describen QUÉ dibujar (marcadores,
 * líneas, encuadre) y el motor decide CÓMO con el SDK de su proveedor (Google,
 * Mapbox…). Nada de este archivo menciona tipos de un proveedor.
 */

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface LimitesMapa {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Estilo semántico del marcador: cada motor lo traduce a su propio icono. */
export type EstiloMarcador = 'tecnico' | 'destino';

export interface MarcadorSpec {
  id: string;
  posicion: Coordenada;
  titulo: string;
  estilo: EstiloMarcador;
}

export interface LineaSpec {
  id: string;
  puntos: Coordenada[];
}

/** Lo que debe verse en el mapa en este momento. */
export interface EscenaMapa {
  marcadores: MarcadorSpec[];
  lineas: LineaSpec[];
}

export interface MapaOpciones {
  centro: Coordenada;
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  /** El mapa no se puede mover fuera de estos límites. */
  limites: LimitesMapa;
}

/** Un mapa ya creado sobre un elemento del DOM. */
export interface MapaInstancia {
  /** Sincroniza lo dibujado con la escena: mueve, crea y quita lo que haga falta. */
  actualizar(escena: EscenaMapa): void;
  /** Encuadra todos los puntos dados, con un margen en píxeles. */
  ajustarA(puntos: Coordenada[], margenPx: number): void;
  centrarEn(centro: Coordenada): void;
  /** Quita todo lo dibujado y suelta el mapa. */
  destruir(): void;
}

export abstract class MapaMotor {
  abstract readonly nombre: string;
  /** `true` cuando el SDK del proveedor quedó operativo. */
  abstract readonly listo: Signal<boolean>;
  abstract readonly cargando: Signal<boolean>;
  abstract cargar(): Promise<boolean>;
  /** Reintenta la carga tras un fallo, descartando lo cacheado. */
  abstract reintentar(): Promise<boolean>;
  abstract crear(el: HTMLElement, opciones: MapaOpciones): MapaInstancia;
}
