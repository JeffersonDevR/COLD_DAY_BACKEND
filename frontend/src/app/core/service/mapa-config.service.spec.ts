import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MapaConfigService } from './mapa-config.service';

describe('MapaConfigService', () => {
  let http: HttpTestingController;
  let service: MapaConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MapaConfigService);
  });

  afterEach(() => http.verify());

  it('toma el centro, los límites, el zoom y la escala de radios del backend', async () => {
    const carga = service.cargar();

    const req = http.expectOne('/api/config/maps');
    expect(req.request.method).toBe('GET');
    req.flush({
      apiKey: 'BROWSER-KEY',
      centro: { lat: 1.25, lng: -70 },
      bounds: { north: 2, south: 1, east: -69, west: -71 },
      zoom: 9,
      radioInicialKm: 12,
      radioMaxKm: 30,
      radioPasoKm: 6,
    });
    await carga;

    expect(service.centro()).toEqual({ lat: 1.25, lng: -70 });
    expect(service.bounds()).toEqual({ north: 2, south: 1, east: -69, west: -71 });
    expect(service.zoom()).toBe(9);
    expect(service.radioInicialKm()).toBe(12);
    expect(service.radioMaxKm()).toBe(30);
    expect(service.radioPasoKm()).toBe(6);
    expect(service.apiKey()).toBe('BROWSER-KEY');
  });

  it('pide la configuración una sola vez', async () => {
    const primera = service.cargar();
    const segunda = service.cargar();

    http.expectOne('/api/config/maps').flush({ centro: { lat: 1.25, lng: -70 } });
    await Promise.all([primera, segunda]);

    http.expectNone('/api/config/maps');
    expect(service.centro().lat).toBe(1.25);
  });

  it('si el backend no responde conserva los valores por defecto', async () => {
    const carga = service.cargar();

    http.expectOne('/api/config/maps').flush('nope', { status: 500, statusText: 'Error' });
    await carga;

    expect(service.centro()).toEqual({ lat: 7.8939, lng: -72.5078 });
    expect(service.bounds()).toEqual({ north: 8.08, south: 7.76, east: -72.41, west: -72.6 });
    expect(service.zoom()).toBe(13);
    expect(service.radioInicialKm()).toBe(10);
    expect(service.radioMaxKm()).toBe(25);
    expect(service.radioPasoKm()).toBe(5);
    expect(service.apiKey()).toBe('');
  });

  it('completa lo que el backend no envía con los valores por defecto', async () => {
    const carga = service.cargar();

    http.expectOne('/api/config/maps').flush({ centro: { lat: 1.25 } });
    await carga;

    expect(service.centro()).toEqual({ lat: 1.25, lng: -72.5078 });
    expect(service.bounds().north).toBe(8.08);
  });
});
