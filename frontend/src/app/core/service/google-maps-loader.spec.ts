import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GoogleMapsLoaderService } from './google-maps-loader';
import { environment } from '../environment/environment';

const SCRIPT_ID = 'google-maps-platform-script';
const KEY_ORIGINAL = environment.googleMapsApiKey;

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * La API recién está lista cuando expone `importLibrary` (contrato que consume
 * `@angular/google-maps`). Simula ese estado en `window.google`.
 */
const marcarApiLista = () => {
  Reflect.set(window, 'google', {
    maps: { importLibrary: () => Promise.resolve({ Map: class {} }) },
  });
};

/**
 * Baja el timeout privado de readiness para que las pruebas no esperen 10s.
 */
const conTimeoutCorto = (service: GoogleMapsLoaderService, ms = 200) => {
  (service as unknown as { readinessTimeoutMs: number }).readinessTimeoutMs = ms;
  return service;
};

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

  it('resuelve true cuando google.maps expone importLibrary (API lista)', async () => {
    marcarApiLista();
    const service = setup();
    expect(await service.init()).toBe(true);
    expect(service.isLoaded()).toBe(true);
  });

  it('no reporta cargado si google.maps existe pero no expone importLibrary', async () => {
    // El bootstrap asíncrono deja `google.maps` vacío antes de estar listo.
    Reflect.set(window, 'google', { maps: {} });
    const service = conTimeoutCorto(setup(), 50);
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});

    expect(await promise).toBe(false);
    expect(service.isLoaded()).toBe(false);
    expect(service.loadError()).toContain('Google Maps');
  });

  it('inyecta el script con la key del endpoint y resuelve cuando la API queda lista', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({ apiKey: 'SERVER_KEY' });
    await tick();

    expect(service.isLoading()).toBe(true);
    expect(service.apiKey()).toBe('SERVER_KEY');
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).toContain('key=SERVER_KEY');
    expect(script.src).toContain('callback=__coldDayMapsInit');

    marcarApiLista();
    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
    expect(service.isLoaded()).toBe(true);
    expect(service.isLoading()).toBe(false);
  });

  it('no resuelve true al disparar onload si importLibrary aún no está disponible', async () => {
    const service = conTimeoutCorto(setup(), 500);
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});
    await tick();

    // Bootstrap temprano: google.maps existe pero sin importLibrary.
    Reflect.set(window, 'google', { maps: {} });
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    script.onload?.(new Event('load'));

    await tick(80);
    expect(service.isLoaded()).toBe(false);

    // Recién cuando la API queda realmente lista se resuelve true.
    marcarApiLista();
    expect(await promise).toBe(true);
    expect(service.isLoaded()).toBe(true);
  });

  it('marca error y resuelve false si la API no queda lista dentro del timeout', async () => {
    const service = conTimeoutCorto(setup(), 60);
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});
    await tick();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    script.onload?.(new Event('load'));

    expect(await promise).toBe(false);
    expect(service.isLoaded()).toBe(false);
    expect(service.isLoading()).toBe(false);
    expect(service.loadError()).toContain('Google Maps');
  });

  it('carga el script sin key si el endpoint de config falla', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush('nope', { status: 500, statusText: 'Error' });
    await tick();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).not.toContain('key=');
    marcarApiLista();
    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
  });

  it('usa la key de environment sin consultar el endpoint', async () => {
    environment.googleMapsApiKey = 'ENV_KEY';
    const service = setup();
    const promise = service.init();
    await tick();
    http.expectNone('/api/config/maps');

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).toContain('key=ENV_KEY');
    marcarApiLista();
    script.onload?.(new Event('load'));
    expect(await promise).toBe(true);
  });

  it('espera la readiness real si el script ya existe en el DOM', async () => {
    const existente = document.createElement('script');
    existente.id = SCRIPT_ID;
    document.head.appendChild(existente);
    const service = conTimeoutCorto(setup(), 500);
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});

    // La API todavía no está lista: no debe resolver de inmediato.
    await tick(80);
    expect(service.isLoaded()).toBe(false);

    marcarApiLista();
    expect(await promise).toBe(true);
    expect(service.isLoaded()).toBe(true);
  });

  it('marca error si el script falla al cargar', async () => {
    const service = setup();
    const promise = service.init();
    http.expectOne('/api/config/maps').flush({});
    await tick();

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
    await tick();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    marcarApiLista();
    script.onload?.(new Event('load'));
    expect(await primera).toBe(true);
    expect(await segunda).toBe(true);
  });
});
