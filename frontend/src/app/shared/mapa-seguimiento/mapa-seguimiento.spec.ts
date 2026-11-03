import { TestBed } from '@angular/core/testing';
import { MapaSeguimiento } from './mapa-seguimiento';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';
import { MapaConfigService } from '../../core/service/mapa-config.service';
import { provideColombianLocale } from '../../core/i18n/locale';
import { Point } from '../../core/models/common.models';

/**
 * Configuración del mapa que publica el backend. El mapa de seguimiento NO
 * lleva sus propios números: si el backend cambia el centro o los límites,
 * el mapa lo sigue.
 */
function mapaConfigStub(centro = { lat: 7.8939, lng: -72.5078 }) {
  return {
    centro: () => centro,
    bounds: () => ({ north: 8.08, south: 7.76, east: -72.41, west: -72.6 }),
    zoom: () => 13,
    radioInicialKm: () => 10,
    radioMaxKm: () => 25,
    radioPasoKm: () => 5,
  };
}

const TECNICO: Point = { latitud: 7.9, longitud: -72.5 };
const DESTINO: Point = { latitud: 7.88, longitud: -72.49 };

/** Stubs the Google geometry library the way the real script exposes it. */
function googleFake(): {
  google?: { maps?: { geometry?: { encoding?: { decodePath?: unknown } } } };
} {
  return globalThis as unknown as {
    google?: { maps?: { geometry?: { encoding?: { decodePath?: unknown } } } };
  };
}

function stubGoogle(decodePath: (encoded: string) => unknown): void {
  googleFake().google = { maps: { geometry: { encoding: { decodePath } } } };
}

/** Google returns `LatLng` objects with `lat()`/`lng()`, not literals. */
function latLng(lat: number, lng: number) {
  return { lat: () => lat, lng: () => lng };
}

function setup() {
  const mapsLoader = { isLoaded: () => false, isLoading: () => false, loadError: () => null, init: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      ...provideColombianLocale(),
      { provide: GoogleMapsLoaderService, useValue: mapsLoader },
      { provide: MapaConfigService, useValue: mapaConfigStub() },
    ],
  });
  const fixture = TestBed.createComponent(MapaSeguimiento);
  return { fixture, component: fixture.componentInstance, mapsLoader };
}

describe('MapaSeguimiento', () => {
  afterEach(() => {
    delete googleFake().google;
  });

  it('el marcador del técnico sigue la posición que llega del sondeo', () => {
    const { fixture, component } = setup();

    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    expect(component.posicionMarcador()).toEqual({ lat: 7.9, lng: -72.5 });

    // El siguiente tick del sondeo mueve al técnico: el marcador lo sigue.
    fixture.componentRef.setInput('posicionTecnico', { latitud: 7.885, longitud: -72.492 });
    expect(component.posicionMarcador()).toEqual({ lat: 7.885, lng: -72.492 });
  });

  it('sin posición del técnico no hay marcador ni ruta (nada inventado)', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('destino', DESTINO);

    expect(component.posicionMarcador()).toBeNull();
    expect(component.ruta()).toEqual([]);
    expect(component.distanciaKm()).toBeNull();
    // Sin posición no se dibuja el mapa: tampoco el marcador del destino.
    expect(component.mostrarMapa()).toBe(false);

    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Todavía no hay posición del técnico');
    // Sin posición no se inventa ninguna distancia.
    expect(texto).not.toContain('km del punto de servicio');
  });

  it('con posición del técnico el mapa se dibuja', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    expect(component.mostrarMapa()).toBe(true);
  });

  it('la ruta es la línea recta entre el técnico y el destino', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    expect(component.ruta().length).toBe(2);
    expect(component.ruta()[0]).toEqual({ lat: 7.9, lng: -72.5 });
    expect(component.ruta()[1]).toEqual({ lat: 7.88, lng: -72.49 });
  });

  it('dibuja la ruta real por calles cuando llega la geometría', () => {
    const { fixture, component } = setup();
    const decodePath = vi.fn(() => [latLng(7.9, -72.5), latLng(7.891, -72.494), latLng(7.88, -72.49)]);
    stubGoogle(decodePath);
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    fixture.componentRef.setInput('rutaCodificada', 'abc_polyline');

    expect(component.ruta()).toEqual([
      { lat: 7.9, lng: -72.5 },
      { lat: 7.891, lng: -72.494 },
      { lat: 7.88, lng: -72.49 },
    ]);
    expect(decodePath).toHaveBeenCalledWith('abc_polyline');
  });

  it('con la ruta vacía vuelve a la línea recta de 2 puntos', () => {
    const { fixture, component } = setup();
    const decodePath = vi.fn(() => [latLng(7.9, -72.5), latLng(7.88, -72.49)]);
    stubGoogle(decodePath);
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    fixture.componentRef.setInput('rutaCodificada', '');

    // `""` es "Google no dio geometría": no se llama al decodificador.
    expect(decodePath).not.toHaveBeenCalled();
    expect(component.ruta()).toEqual([
      { lat: 7.9, lng: -72.5 },
      { lat: 7.88, lng: -72.49 },
    ]);
  });

  it('con una geometría malformada no rompe el mapa: vuelve a la recta', () => {
    const { fixture, component } = setup();
    stubGoogle(() => {
      throw new Error('Invalid character');
    });
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    expect(() => fixture.componentRef.setInput('rutaCodificada', 'no-es-un-polyline')).not.toThrow();
    expect(component.ruta()).toEqual([
      { lat: 7.9, lng: -72.5 },
      { lat: 7.88, lng: -72.49 },
    ]);
  });

  it('sin la librería de geometría cargada vuelve a la recta', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);
    fixture.componentRef.setInput('rutaCodificada', 'abc_polyline');

    expect(component.ruta()).toEqual([
      { lat: 7.9, lng: -72.5 },
      { lat: 7.88, lng: -72.49 },
    ]);
  });

  it('calcula la distancia en el navegador, sin llamar a Google', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    // Línea recta entre (7.9, -72.5) y (7.88, -72.49): 2,48 km.
    expect(component.distanciaKm()).toBeCloseTo(2.48, 2);
  });

  it('centra el mapa en el punto medio de la ruta y acota los límites', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);

    expect(component.centro().lat).toBeCloseTo(7.89, 6);
    expect(component.centro().lng).toBeCloseTo(-72.495, 6);
    expect(component.mapOptions().restriction?.latLngBounds).toEqual({
      north: 8.08,
      south: 7.76,
      east: -72.41,
      west: -72.6,
    });
    expect(component.zoomNivel()).toBe(13);
  });

  it('sin datos usa el centro que publica el backend', () => {
    const { component } = setup();
    expect(component.centro()).toEqual({ lat: 7.8939, lng: -72.5078 });
  });

  it('carga el script de Google a través del loader compartido (una sola vez)', () => {
    const { fixture, mapsLoader } = setup();
    fixture.detectChanges();

    // El loader es single-flight: llamarlo desde otro mapa no recarga el script.
    expect(mapsLoader.init).toHaveBeenCalledTimes(1);
  });

  it('degrada sin mapa: la distancia sigue en texto', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Mapa no disponible');
    // es-CO: coma decimal en el pipe number.
    expect(texto).toContain('2,5 km');
  });

  it('con la llegada registrada el mapa dice que ya llegó, no que sigue en camino', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('posicionTecnico', TECNICO);
    fixture.componentRef.setInput('destino', DESTINO);
    fixture.componentRef.setInput('tecnicoNombre', 'Juan');
    fixture.detectChanges();

    // Sin llegada: el mapa sigue diciendo "En camino:" con la distancia.
    expect(fixture.nativeElement.textContent).toContain('En camino:');

    // Ya llegó: el mapa no puede seguir diciendo que está en camino.
    fixture.componentRef.setInput('llegada', true);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('En camino:');
    expect(texto).not.toContain('en camino');
    // El badge dice la llegada...
    expect(texto).toContain('Juan ya llegó');
    // ...y el texto que se anuncia con aria-live tampoco contradice.
    expect(texto).toContain('Juan ya llegó al punto de servicio');
  });
});
