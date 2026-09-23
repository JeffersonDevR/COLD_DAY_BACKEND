import { TestBed } from '@angular/core/testing';
import { ApiConfig } from './api.config';
import { environment } from '../../../../../environments/environment';

describe('ApiConfig', () => {
  let config: ApiConfig;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    config = TestBed.inject(ApiConfig);
  });

  it('construye urls con y sin slash inicial', () => {
    expect(config.url('/ot')).toBe(`${environment.apiBaseUrl}/ot`);
    expect(config.url('ot')).toBe(`${environment.apiBaseUrl}/ot`);
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

  it('expone baseUrl y alias useMock', () => {
    expect(config.baseUrl).toBe(environment.apiBaseUrl);
    expect(config.useMock()).toBe(config.useMocks());
  });
});
