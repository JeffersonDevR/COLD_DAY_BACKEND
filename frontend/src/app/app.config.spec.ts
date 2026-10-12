import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { LEGACY_THEME_STORAGE_KEY } from './core/service/appearance';

/**
 * R3 de `appearance`: al arrancar la app, una preferencia de tema persistida por
 * el configurador eliminado se descarta (no se honra) y el resto de preferencias
 * del usuario permanecen intactas.
 */
describe('appConfig', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function arrancarApp(): void {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    // Inyectar ApplicationInitStatus ejecuta los initializers de la app.
    TestBed.inject(ApplicationInitStatus);
  }

  it('descarta la preferencia de tema heredada al arrancar', () => {
    window.localStorage.setItem(
      LEGACY_THEME_STORAGE_KEY,
      JSON.stringify({ dark: true, preset: 'Nora', primary: 'violet', surface: 'zinc' }),
    );

    arrancarApp();

    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
  });

  it('conserva las demás preferencias del usuario', () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'dark');
    window.localStorage.setItem('coldday.layout', '{"menuMode":"overlay"}');

    arrancarApp();

    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('coldday.layout')).toBe('{"menuMode":"overlay"}');
  });
});
