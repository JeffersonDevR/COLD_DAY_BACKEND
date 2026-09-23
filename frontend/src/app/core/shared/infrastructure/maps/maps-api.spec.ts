import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MapsApi } from './maps-api';
import { ApiConfig } from '../api/api.config';

describe('MapsApi', () => {
  let api: MapsApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MapsApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('estado consulta /api/maps/estado', async () => {
    const promise = firstValueFrom(api.estado());
    const req = http.expectOne('/api/maps/estado');
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: true, configured: true, language: 'es', region: 'CO' });
    expect((await promise).enabled).toBe(true);
  });

  it('geocodificar hace POST con la dirección', async () => {
    const promise = firstValueFrom(api.geocodificar('calle 1'));
    const req = http.expectOne('/api/maps/geocode');
    expect(req.request.body).toEqual({ direccion: 'calle 1' });
    req.flush({ direccionFormateada: 'calle 1', latitud: 1, longitud: 2, placeId: 'p' });
    expect((await promise).placeId).toBe('p');
  });

  it('inversa envía lat y lng como parámetros', async () => {
    const promise = firstValueFrom(api.inversa(4.6, -74.1));
    const req = http.expectOne((r) => r.url === '/api/maps/inversa');
    expect(req.request.params.get('lat')).toBe('4.6');
    expect(req.request.params.get('lng')).toBe('-74.1');
    req.flush({ direccionFormateada: 'x', latitud: 4.6, longitud: -74.1, placeId: 'p' });
    expect((await promise).latitud).toBe(4.6);
  });

  it('autocompletar incluye el sesgo cuando viene', async () => {
    const promise = firstValueFrom(api.autocompletar('caobos', { latitud: 7.8, longitud: -72.5 }));
    const req = http.expectOne((r) => r.url === '/api/maps/autocompletar');
    expect(req.request.params.get('input')).toBe('caobos');
    expect(req.request.params.get('lat')).toBe('7.8');
    expect(req.request.params.get('lng')).toBe('-72.5');
    req.flush([]);
    expect(await promise).toEqual([]);
  });

  it('autocompletar omite el sesgo si no viene', async () => {
    const promise = firstValueFrom(api.autocompletar('centro'));
    const req = http.expectOne((r) => r.url === '/api/maps/autocompletar');
    expect(req.request.params.has('lat')).toBe(false);
    req.flush([]);
    await promise;
  });

  it('distancia envía el cuadro de coordenadas', async () => {
    const promise = firstValueFrom(api.distancia({ latitud: 1, longitud: 2 }, { latitud: 3, longitud: 4 }));
    const req = http.expectOne('/api/maps/distancia');
    expect(req.request.body).toEqual({ origenLat: 1, origenLng: 2, destinoLat: 3, destinoLng: 4 });
    req.flush({ distanciaKm: 5, duracionMin: 10, distanciaTexto: '5 km', duracionTexto: '10 min' });
    expect((await promise).distanciaKm).toBe(5);
  });

  it('en modo mock geocodifica y calcula distancia', async () => {
    config.setUseMocks(true);
    const dir = await firstValueFrom(api.geocodificar('Calle 15'));
    expect(dir.direccionFormateada).toBe('Calle 15');
    expect(dir.placeId).toContain('mock-');

    const distancia = await firstValueFrom(
      api.distancia({ latitud: 7.8872, longitud: -72.4951 }, { latitud: 7.9045, longitud: -72.4977 }),
    );
    expect(distancia.distanciaKm).toBeGreaterThan(0);
    expect(distancia.duracionMin).toBeGreaterThanOrEqual(0);
  });

  it('en modo mock filtra las sugerencias de autocompletado', async () => {
    config.setUseMocks(true);
    const sugerencias = await firstValueFrom(api.autocompletar('caobos'));
    expect(sugerencias.length).toBe(1);
    expect(sugerencias[0].placeId).toBe('mock-caobos');
    expect(await firstValueFrom(api.autocompletar('zzz'))).toEqual([]);
  });
});
