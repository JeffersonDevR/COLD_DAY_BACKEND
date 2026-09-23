import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GoogleMapsLoaderService } from './google-maps-loader';
import { environment } from '../../../../../environments/environment';

const SCRIPT_ID = 'google-maps-platform-script';
const KEY_ORIGINAL = environment.googleMapsApiKey;

describe('GoogleMapsLoaderService', () => {
  let http: HttpTestingController;

  function setup(platform = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(GoogleMapsLoaderService);
  }

  const limpiar = () => {
    document.getElementById(SCRIPT_ID)?.remove();
    Reflect.deleteProperty(window, 'google');
    Reflect.deleteProperty(window, '__coldDayMapsInit');
  };

  beforeEach(() => {
    environment.googleMapsApiKey = '';
    limpiar();
  });

  afterEach(() => {
    environment.googleMapsApiKey = KEY_ORIGINAL;
    http.verify();
    limpiar();
  });

  it('no inicializa en el servidor', async () => {
    const service = setup('server');
    expect(await service.init()).toBe(false);
    expect(service.isLoaded()).toBe(false);
  });

  it('resuelve true si google.maps ya está presente', async () => {
    Reflect.set(window, 'google', { maps: {} });
    const service = setup();
    expect(await service.init()).toBe(true);
    expect(service.isLoaded()).toBe(true);
  });

  it('inyecta el script con la key del endpoint y resuelve al onload', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({ apiKey: 'SERVER_KEY' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.isLoading()).toBe(true);
    expect(service.apiKey()).toBe('SERVER_KEY');
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).toContain('key=SERVER_KEY');
    expect(script.src).toContain('callback=__coldDayMapsInit');

    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
    expect(service.isLoaded()).toBe(true);
    expect(service.isLoading()).toBe(false);
  });

  it('carga el script sin key si el endpoint de config falla', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush('nope', { status: 500, statusText: 'Error' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).not.toContain('key=');
    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
  });

  it('usa la key de environment sin consultar el endpoint', async () => {
    environment.googleMapsApiKey = 'ENV_KEY';
    const service = setup();
    const promise = service.init();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectNone('/api/config/maps');

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).toContain('key=ENV_KEY');
    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
  });

  it('resuelve true si el script ya existe en el DOM', async () => {
    const existente = document.createElement('script');
    existente.id = SCRIPT_ID;
    document.head.appendChild(existente);
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});
    expect(await promise).toBe(true);
  });

  it('marca error si el script falla al cargar', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});
    await new Promise((resolve) => setTimeout(resolve, 0));

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    script.onerror?.(new Event('error'));
    expect(await promise).toBe(false);
    expect(service.loadError()).toContain('Google Maps');
    expect(service.isLoading()).toBe(false);
  });

  it('reutiliza la promesa en llamadas concurrentes', async () => {
    const service = setup();
    const primera = service.init();
    const segunda = service.init();
    http.expectOne('/api/config/maps').flush({});
    await new Promise((resolve) => setTimeout(resolve, 0));

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    script.onload?.(new Event('load'));
    expect(await primera).toBe(true);
    expect(await segunda).toBe(true);
  });
});
