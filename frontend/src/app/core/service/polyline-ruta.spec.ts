import { decodificarRuta } from './polyline-ruta';

/**
 * El decoder lee `window.google.maps.geometry.encoding.decodePath` con un
 * acceso laxo: acá se instala un `google` falso completo y se restaura el
 * original al final de cada test.
 */

function instalarGoogleFalso(decodePath: unknown): void {
  const win = window as unknown as Record<string, unknown>;
  win['google'] = {
    maps: {
      geometry: {
        encoding: { decodePath },
      },
    },
  };
}

function desinstalarGoogleFalso(original: unknown): void {
  const win = window as unknown as Record<string, unknown>;
  if (original === undefined) {
    delete win['google'];
  } else {
    win['google'] = original;
  }
}

describe('decodificarRuta', () => {
  const ventana = window as unknown as Record<string, unknown>;
  const originalGoogle = ventana['google'];

  afterEach(() => {
    desinstalarGoogleFalso(originalGoogle);
  });

  it('devuelve null sin polyline', () => {
    expect(decodificarRuta(null)).toBeNull();
    expect(decodificarRuta(undefined)).toBeNull();
    expect(decodificarRuta('')).toBeNull();
  });

  it('devuelve null cuando la API de Google no está cargada', () => {
    desinstalarGoogleFalso(undefined);

    expect(decodificarRuta('abc123')).toBeNull();
  });

  it('decodifica con la API geometry cuando está disponible', () => {
    instalarGoogleFalso(() => [
      { lat: () => 7.89, lng: () => -72.5 },
      { lat: () => 7.95, lng: () => -72.55 },
    ]);

    expect(decodificarRuta('abc123')).toEqual([
      { lat: 7.89, lng: -72.5 },
      { lat: 7.95, lng: -72.55 },
    ]);
  });

  it('una polyline malformada devuelve null (nunca rompe el mapa)', () => {
    instalarGoogleFalso(() => {
      throw new Error('polyline ilegible');
    });

    expect(decodificarRuta('no-es-una-polyline')).toBeNull();
  });

  it('un resultado con menos de dos puntos se descarta', () => {
    instalarGoogleFalso(() => [{ lat: () => 7.89, lng: () => -72.5 }]);

    expect(decodificarRuta('abc')).toBeNull();
  });
});
