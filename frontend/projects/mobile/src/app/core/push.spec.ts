import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CANAL_PUSH, PUSH, PushNotificacionesService, rutaDeNotificacion } from './push';

describe('rutaDeNotificacion', () => {
  it('acepta rutas propias de un modo', () => {
    expect(rutaDeNotificacion({ ruta: '/tecnico/radar' })).toBe('/tecnico/radar');
    expect(rutaDeNotificacion({ ruta: '/cliente/ot/abc-123' })).toBe('/cliente/ot/abc-123');
  });

  it('rechaza rutas ajenas, relativas o con escape', () => {
    expect(rutaDeNotificacion(undefined)).toBeNull();
    expect(rutaDeNotificacion({ ruta: 'https://evil.example' })).toBeNull();
    expect(rutaDeNotificacion({ ruta: '//evil.example/x' })).toBeNull();
    expect(rutaDeNotificacion({ ruta: '/tecnico/../login' })).toBeNull();
    expect(rutaDeNotificacion({ ruta: '/admin/panel' })).toBeNull();
    expect(rutaDeNotificacion({ ruta: 42 })).toBeNull();
  });
});

describe('PushNotificacionesService', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return {
      servicio: TestBed.inject(PushNotificacionesService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('queda habilitado ahora que existe Firebase', () => {
    expect(PUSH.habilitado).toBe(true);
    expect(CANAL_PUSH).toBe('ofertas');
  });

  it('activar es no-op fuera de nativo o deshabilitado', async () => {
    const { servicio, http } = setup();

    await servicio.activar({ habilitado: true }); // en web no es nativo
    await servicio.activar();

    expect(servicio.tieneToken()).toBe(false);
    http.verify();
  });

  it('desactivar sin token no llama al backend', async () => {
    const { servicio, http } = setup();

    await servicio.desactivar();

    http.verify();
  });
});
