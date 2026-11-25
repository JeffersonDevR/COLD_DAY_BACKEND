import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleMapsLoaderService } from '../service/google-maps-loader';
import { GoogleMotor } from './google-motor';
import type { EscenaMapa, MapaOpciones } from './mapa-motor';

const OPCIONES: MapaOpciones = {
  centro: { lat: 7.89, lng: -72.5 },
  zoom: 13,
  zoomMin: 11,
  zoomMax: 18,
  limites: { north: 8.08, south: 7.76, east: -72.41, west: -72.6 },
};

class FakeMarker {
  static todos: FakeMarker[] = [];
  mapa: unknown = 'sin-poner';
  constructor(public opciones: Record<string, unknown>) {
    FakeMarker.todos.push(this);
  }
  setMap(mapa: unknown) { this.mapa = mapa; }
  setPosition(p: unknown) { this.opciones['position'] = p; }
  setTitle(t: string) { this.opciones['title'] = t; }
}

class FakePolyline {
  static todas: FakePolyline[] = [];
  mapa: unknown = 'sin-poner';
  constructor(public opciones: Record<string, unknown>) {
    FakePolyline.todas.push(this);
  }
  setMap(mapa: unknown) { this.mapa = mapa; }
  setPath(p: unknown) { this.opciones['path'] = p; }
}

class FakeBounds {
  puntos: unknown[] = [];
  extend(p: unknown) { this.puntos.push(p); }
}

class FakeMap {
  static ultimo: FakeMap | null = null;
  fitBounds = vi.fn();
  setCenter = vi.fn();
  constructor(public el: HTMLElement, public opciones: Record<string, unknown>) {
    FakeMap.ultimo = this;
  }
}

function escena(tecnico: boolean, lineaPuntos = 2): EscenaMapa {
  return {
    marcadores: tecnico
      ? [
          { id: 'tecnico', posicion: { lat: 7.9, lng: -72.5 }, titulo: 'Juan', estilo: 'tecnico' },
          { id: 'destino', posicion: { lat: 7.8, lng: -72.4 }, titulo: 'Casa', estilo: 'destino' },
        ]
      : [{ id: 'destino', posicion: { lat: 7.8, lng: -72.4 }, titulo: 'Casa', estilo: 'destino' }],
    lineas: [
      {
        id: 'ruta',
        puntos: Array.from({ length: lineaPuntos }, (_, i) => ({ lat: 7.8 + i / 100, lng: -72.4 })),
      },
    ],
  };
}

describe('GoogleMotor', () => {
  const loader = {
    isLoaded: signal(true),
    isLoading: signal(false),
    init: vi.fn(() => Promise.resolve(true)),
    reintentar: vi.fn(() => Promise.resolve(true)),
  };
  let motor: GoogleMotor;
  let el: HTMLDivElement;

  beforeEach(() => {
    FakeMarker.todos = [];
    FakePolyline.todas = [];
    FakeMap.ultimo = null;
    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: FakeMap,
        Marker: FakeMarker,
        Polyline: FakePolyline,
        LatLngBounds: FakeBounds,
        SymbolPath: { CIRCLE: 0 },
      },
    };
    loader.isLoaded.set(true);
    loader.isLoading.set(false);
    loader.init.mockClear();
    loader.reintentar.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: GoogleMapsLoaderService, useValue: loader }],
    });
    motor = TestBed.inject(GoogleMotor);
    el = document.createElement('div');
  });

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
  });

  it('se llama google y refleja el estado del cargador', () => {
    expect(motor.nombre).toBe('google');
    expect(motor.listo()).toBe(true);
    loader.isLoaded.set(false);
    loader.isLoading.set(true);
    expect(motor.listo()).toBe(false);
    expect(motor.cargando()).toBe(true);
  });

  it('cargar y reintentar delegan en el cargador', async () => {
    await motor.cargar();
    await motor.reintentar();
    expect(loader.init).toHaveBeenCalledTimes(1);
    expect(loader.reintentar).toHaveBeenCalledTimes(1);
  });

  it('crea el mapa con zoom, límites estrictos y sin controles de más', () => {
    motor.crear(el, OPCIONES);

    const o = FakeMap.ultimo!.opciones;
    expect(FakeMap.ultimo!.el).toBe(el);
    expect(o['zoom']).toBe(13);
    expect(o['minZoom']).toBe(11);
    expect(o['maxZoom']).toBe(18);
    expect(o['center']).toEqual(OPCIONES.centro);
    expect(o['restriction']).toEqual({ latLngBounds: OPCIONES.limites, strictBounds: true });
    expect(o['streetViewControl']).toBe(false);
    expect(o['zoomControl']).toBe(true);
  });

  it('pinta el técnico en cian y el destino en ámbar', () => {
    motor.crear(el, OPCIONES).actualizar(escena(true));

    const [tecnico, destino] = FakeMarker.todos;
    expect((tecnico.opciones['icon'] as Record<string, unknown>)['fillColor']).toBe('#22d3ee');
    expect(tecnico.opciones['zIndex']).toBe(2);
    expect((destino.opciones['icon'] as Record<string, unknown>)['fillColor']).toBe('#f59e0b');
    expect(destino.opciones['zIndex']).toBe(1);
  });

  it('un marcador con el mismo id se mueve y no se vuelve a crear', () => {
    const instancia = motor.crear(el, OPCIONES);
    instancia.actualizar(escena(true));
    const antes = FakeMarker.todos.length;

    const nueva = escena(true);
    nueva.marcadores[0].posicion = { lat: 7.95, lng: -72.55 };
    instancia.actualizar(nueva);

    expect(FakeMarker.todos).toHaveLength(antes);
    expect(FakeMarker.todos[0].opciones['position']).toEqual({ lat: 7.95, lng: -72.55 });
  });

  it('un marcador que sale de la escena se quita del mapa', () => {
    const instancia = motor.crear(el, OPCIONES);
    instancia.actualizar(escena(true));
    const tecnico = FakeMarker.todos[0];

    instancia.actualizar(escena(false));

    expect(tecnico.mapa).toBeNull();
  });

  it('una línea de un punto no se dibuja y una de dos sí', () => {
    const instancia = motor.crear(el, OPCIONES);
    instancia.actualizar(escena(true, 1));
    expect(FakePolyline.todas).toHaveLength(0);

    instancia.actualizar(escena(true, 2));
    expect(FakePolyline.todas).toHaveLength(1);
    expect(FakePolyline.todas[0].opciones['strokeColor']).toBe('#22d3ee');
    expect(FakePolyline.todas[0].opciones['strokeWeight']).toBe(3);

    instancia.actualizar(escena(true, 1));
    expect(FakePolyline.todas[0].mapa).toBeNull();
  });

  it('ajustarA encuadra los puntos con el margen y centrarEn recentra', () => {
    const instancia = motor.crear(el, OPCIONES);

    instancia.ajustarA([{ lat: 7.9, lng: -72.5 }, { lat: 7.8, lng: -72.4 }], 48);
    instancia.centrarEn({ lat: 7.7, lng: -72.3 });

    const [limites, margen] = FakeMap.ultimo!.fitBounds.mock.calls[0];
    expect((limites as FakeBounds).puntos).toHaveLength(2);
    expect(margen).toBe(48);
    expect(FakeMap.ultimo!.setCenter).toHaveBeenCalledWith({ lat: 7.7, lng: -72.3 });
  });

  it('destruir quita marcadores y línea y deja inertes las llamadas siguientes', () => {
    const instancia = motor.crear(el, OPCIONES);
    instancia.actualizar(escena(true));

    instancia.destruir();

    expect(FakeMarker.todos.every((m) => m.mapa === null)).toBe(true);
    expect(FakePolyline.todas.every((p) => p.mapa === null)).toBe(true);
    expect(() => instancia.actualizar(escena(true))).not.toThrow();
    expect(FakeMarker.todos).toHaveLength(2);
  });
});
