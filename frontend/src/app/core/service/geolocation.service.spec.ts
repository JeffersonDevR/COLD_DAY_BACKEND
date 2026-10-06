import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { GeolocationService } from './geolocation.service';

interface GeoMock {
  getCurrentPosition?: (
    ok: (pos: GeolocationPosition) => void,
    err?: (e: GeolocationPositionError) => void,
  ) => void;
  watchPosition?: (ok: (pos: GeolocationPosition) => void, err?: (e: GeolocationPositionError) => void) => number;
  clearWatch?: (id: number) => void;
}

function setGeolocation(mock: GeoMock): void {
  Object.defineProperty(navigator, 'geolocation', { value: mock, configurable: true });
}

function posicion(lat: number, lng: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng } } as unknown as GeolocationPosition;
}

function errorGeo(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as unknown as GeolocationPositionError;
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error('se esperaba un rechazo');
  } catch (err) {
    return err;
  }
}

describe('GeolocationService', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('resuelve la posición actual como Point', async () => {
    setGeolocation({ getCurrentPosition: (ok) => ok(posicion(4.6, -74.1)) });
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);
    expect(service.disponible).toBe(true);
    expect(await firstValueFrom(service.obtenerPosicion())).toEqual({ latitud: 4.6, longitud: -74.1 });
  });

  it('mapea el error de permiso denegado', async () => {
    setGeolocation({ getCurrentPosition: (_ok, err) => err?.(errorGeo(1)) });
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);
    const caught = await capture(firstValueFrom(service.obtenerPosicion()));
    expect((caught as Error).message).toContain('Permiso de ubicación denegado');
  });

  it('mapea el error de timeout', async () => {
    setGeolocation({ getCurrentPosition: (_ok, err) => err?.(errorGeo(3)) });
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);
    const caught = await capture(firstValueFrom(service.obtenerPosicion()));
    expect((caught as Error).message).toContain('Se agotó el tiempo');
  });

  it('rechaza cuando la geolocalización no está disponible', async () => {
    Reflect.deleteProperty(navigator, 'geolocation');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);
    expect(service.disponible).toBe(false);
    const caught = await capture(firstValueFrom(service.obtenerPosicion()));
    expect((caught as Error).message).toContain('no está disponible');
  });

  it('vigila la posición y limpia el watch al desuscribirse', () => {
    const clearWatch = vi.fn();
    let emitir: ((pos: GeolocationPosition) => void) | undefined;
    setGeolocation({
      watchPosition: (ok) => {
        emitir = ok;
        return 42;
      },
      clearWatch,
    });
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);

    const recibidos: { latitud: number; longitud: number }[] = [];
    const sub = service.vigilarPosicion().subscribe((p) => recibidos.push(p));
    emitir?.(posicion(1, 2));

    expect(recibidos).toEqual([{ latitud: 1, longitud: 2 }]);
    sub.unsubscribe();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('vigilarPosicion emite error si no está disponible', async () => {
    Reflect.deleteProperty(navigator, 'geolocation');
    TestBed.configureTestingModule({});
    const service = TestBed.inject(GeolocationService);
    const caught = await capture(firstValueFrom(service.vigilarPosicion()));
    expect((caught as Error).message).toContain('no está disponible');
  });
});
