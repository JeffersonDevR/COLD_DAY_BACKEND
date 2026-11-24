import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CANALES_PUSH, PUSH, PushNotificacionesService, rutaDeNotificacion } from './push';

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
  });

  it('los canales coinciden con los ids del backend y usan los dos sonidos', () => {
    // Contrato con CanalPush.java: un id distinto deja el push sin sonido propio.
    expect(CANALES_PUSH.map((c) => c.id)).toEqual([
      'ot_nueva_tec',
      'ot_update_tec',
      'ot_nueva_cli',
      'ot_update_cli',
    ]);
    expect(new Set(CANALES_PUSH.map((c) => c.sound))).toEqual(
      new Set(['switch_006.ogg', 'switch_007.ogg']),
    );
    expect(CANALES_PUSH.find((c) => c.id === 'ot_nueva_tec')?.sound).toBe('switch_007.ogg');
    expect(CANALES_PUSH.find((c) => c.id === 'ot_nueva_cli')?.sound).toBe('switch_006.ogg');
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
