import { TestBed } from '@angular/core/testing';
import { API_ORIGIN, ApiConfig } from './api.config';

/**
 * El origen se inyecta desde build (variable API_ORIGIN): vacío resuelve URLs
 * relativas (proxy dev / mismo origen) y con host se compone la URL absoluta
 * que usan las builds nativas (Capacitor) y la web en producción.
 */
function setup(origen: string): ApiConfig {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: API_ORIGIN, useValue: origen }],
  });
  return TestBed.inject(ApiConfig);
}

describe('ApiConfig', () => {
  let config: ApiConfig;

  beforeEach(() => {
    config = setup('http://test.local');
  });

  it('compone el origen + /api + path con y sin slash inicial', () => {
    expect(config.url('/ot')).toBe('http://test.local/api/ot');
    expect(config.url('ot')).toBe('http://test.local/api/ot');
  });

  it('compone URLs absolutas con un origen https real (build nativa desplegada)', () => {
    const remota = setup('https://api.midominio.co');
    expect(remota.url('/ot')).toBe('https://api.midominio.co/api/ot');
    expect(remota.url('ot')).toBe('https://api.midominio.co/api/ot');
    // Rutas que consume el stream SSE de la OT y el ticket del canal:
    // EventSource exige URL absoluta cuando el backend no es el mismo origen.
    expect(remota.url('/sse/ticket')).toBe('https://api.midominio.co/api/sse/ticket');
    expect(remota.url('/ot/ot1/stream')).toBe('https://api.midominio.co/api/ot/ot1/stream');
  });

  it('versioned compone la version explicita en la ruta', () => {
    expect(config.versioned('v2', '/ot')).toBe('http://test.local/api/v2/ot');
  });

  it('versioned con version vacia deja la ruta sin segmento de version', () => {
    expect(config.versioned('', '/ot')).toBe('http://test.local/api/ot');
  });

  it('expone el origen inyectable (token) y no el de environment', () => {
    expect(config.origin()).toBe('http://test.local');
  });

  it('toggleMocks alterna el flag', () => {
    const inicial = config.useMocks();
    expect(config.toggleMocks()).toBe(!inicial);
    expect(config.useMocks()).toBe(!inicial);
    expect(config.toggleMock()).toBe(inicial);
  });

  it('setUseMocks fija el valor', () => {
    config.setUseMocks(true);
    expect(config.useMocks()).toBe(true);
    config.setUseMocks(false);
    expect(config.useMocks()).toBe(false);
  });

  it('expone el alias useMock', () => {
    expect(config.useMock()).toBe(config.useMocks());
  });
});
