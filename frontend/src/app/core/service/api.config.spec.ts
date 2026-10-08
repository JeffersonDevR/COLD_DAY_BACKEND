import { TestBed } from '@angular/core/testing';
import { API_ORIGIN, ApiConfig } from './api.config';

describe('ApiConfig', () => {
  let config: ApiConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: API_ORIGIN, useValue: 'http://test.local' }],
    });
    config = TestBed.inject(ApiConfig);
  });

  it('compone el origen + /api + path con y sin slash inicial', () => {
    expect(config.url('/ot')).toBe('http://test.local/api/ot');
    expect(config.url('ot')).toBe('http://test.local/api/ot');
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
