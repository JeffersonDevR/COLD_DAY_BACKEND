import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CuentasApi } from './cuentas-api';
import { ApiConfig } from './api.config';

describe('CuentasApi', () => {
  let api: CuentasApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CuentasApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('lista, crea y cambia el estado contra /admin/cuentas', () => {
    api.listar().subscribe();
    expect(http.expectOne(config.url('/admin/cuentas')).request.method).toBe('GET');

    api.crear({ nombre: 'Laura', correo: 'laura@example.com', rol: 'RECURSOS_HUMANOS' }).subscribe();
    const alta = http.expectOne((r) => r.method === 'POST' && r.url === config.url('/admin/cuentas'));
    expect(alta.request.body).toEqual({ nombre: 'Laura', correo: 'laura@example.com', rol: 'RECURSOS_HUMANOS' });

    api.cambiarEstado(7, false).subscribe();
    const estado = http.expectOne(config.url('/admin/cuentas/7/estado'));
    expect(estado.request.method).toBe('PATCH');
    expect(estado.request.body).toEqual({ activa: false });
  });
});
