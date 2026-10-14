import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MapsGeocoderCliente } from './maps-geocoder-cliente';
import { GoogleMapsLoaderService } from './google-maps-loader';

describe('MapsGeocoderCliente', () => {
  let geocodeSpy: ReturnType<typeof vi.fn>;
  let predictionsSpy: ReturnType<typeof vi.fn>;
  let loader: { init: ReturnType<typeof vi.fn>; isLoaded: () => boolean; loadError: () => string | null };

  const resultadoGeocode = {
    formatted_address: 'Calle 1 # 2-3, Cúcuta',
    geometry: { location: { lat: () => 7.9, lng: () => -72.5 } },
    place_id: 'g1',
  };

  beforeEach(() => {
    geocodeSpy = vi.fn();
    predictionsSpy = vi.fn();
    class FakeGeocoder {
      geocode = geocodeSpy;
    }
    class FakeAutocomplete {
      getPlacePredictions = predictionsSpy;
    }
    (globalThis as any).google = {
      maps: {
        LatLng: class {
          constructor(
            public lat: number,
            public lng: number,
          ) {}
        },
        Geocoder: FakeGeocoder,
        GeocoderStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
        places: {
          AutocompleteService: FakeAutocomplete,
          PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
        },
      },
    };
    loader = { init: vi.fn(() => Promise.resolve(true)), isLoaded: () => true, loadError: () => null };
    TestBed.configureTestingModule({
      providers: [{ provide: GoogleMapsLoaderService, useValue: loader }],
    });
  });

  afterEach(() => {
    delete (globalThis as any).google;
  });

  it('geocodificar mapea el resultado de Google al contrato del front', async () => {
    geocodeSpy.mockImplementation((_req: unknown, cb: (r: unknown, s: string) => void) => cb([resultadoGeocode], 'OK'));
    const dir = await firstValueFrom(TestBed.inject(MapsGeocoderCliente).geocodificar('Calle 1'));
    expect(dir).toEqual({
      direccionFormateada: 'Calle 1 # 2-3, Cúcuta',
      latitud: 7.9,
      longitud: -72.5,
      placeId: 'g1',
    });
    // Sesgo a Colombia.
    expect(geocodeSpy.mock.calls[0][0]).toMatchObject({ componentRestrictions: { country: 'co' } });
  });

  it('geocodificar emite error si Google no devuelve OK', async () => {
    geocodeSpy.mockImplementation((_req: unknown, cb: (r: unknown, s: string) => void) => cb([], 'ZERO_RESULTS'));
    await expect(firstValueFrom(TestBed.inject(MapsGeocoderCliente).geocodificar('xxx'))).rejects.toThrow();
  });

  it('inversa pasa location con lat/lng y mapea la dirección', async () => {
    geocodeSpy.mockImplementation((_req: unknown, cb: (r: unknown, s: string) => void) => cb([resultadoGeocode], 'OK'));
    const dir = await firstValueFrom(TestBed.inject(MapsGeocoderCliente).inversa(7.9, -72.49));
    expect(dir.latitud).toBe(7.9);
    expect(geocodeSpy.mock.calls[0][0]).toMatchObject({ location: { lat: 7.9, lng: -72.49 } });
  });

  it('autocompletar mapea las predicciones a sugerencias', async () => {
    predictionsSpy.mockImplementation((_req: unknown, cb: (p: unknown, s: string) => void) =>
      cb([{ description: 'Calle 1, Cúcuta', place_id: 'p1' }], 'OK'),
    );
    const lista = await firstValueFrom(
      TestBed.inject(MapsGeocoderCliente).autocompletar('calle 1', { latitud: 7.9, longitud: -72.5 }),
    );
    expect(lista).toEqual([{ descripcion: 'Calle 1, Cúcuta', placeId: 'p1' }]);
    expect(predictionsSpy.mock.calls[0][0]).toMatchObject({
      input: 'calle 1',
      componentRestrictions: { country: 'co' },
      types: ['address'],
    });
  });

  it('autocompletar devuelve vacío si Google no trae predicciones', async () => {
    predictionsSpy.mockImplementation((_req: unknown, cb: (p: unknown, s: string) => void) => cb([], 'ZERO_RESULTS'));
    const lista = await firstValueFrom(TestBed.inject(MapsGeocoderCliente).autocompletar('zzz'));
    expect(lista).toEqual([]);
  });

  it('emite error si la API de Google no logra cargar (no cuelga)', async () => {
    loader.init.mockReturnValue(Promise.resolve(false));
    loader.loadError = () => 'sin key de navegador';
    loader.isLoaded = () => false;
    await expect(firstValueFrom(TestBed.inject(MapsGeocoderCliente).geocodificar('x'))).rejects.toThrow('sin key');
  });
});
