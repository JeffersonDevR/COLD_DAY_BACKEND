import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { LiquidacionApi } from './liquidacion-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { LiquidacionApiResponse } from '../../../core/shared/infrastructure/api/backend.dto';

function liquidacionDto(overrides: Partial<LiquidacionApiResponse> = {}): LiquidacionApiResponse {
  return {
    id: 'l1',
    otId: 'ot1',
    tecnicoId: 'TEC-001',
    montoCobrado: 100000,
    medioPago: 'EFECTIVO',
    porcentajeComision: 0.15,
    valorComision: 15000,
    estado: 'PENDIENTE_CONSIGNACION',
    comprobanteUrl: null,
    motivoRechazo: null,
    creadaEn: '2026-01-01T00:00:00',
    verificadaEn: null,
    tecnicoNombre: null,
    ...overrides,
  };
}

describe('LiquidacionApi', () => {
  let api: LiquidacionApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LiquidacionApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('getLiquidacionesPorTecnico traduce la lista', async () => {
    const promise = firstValueFrom(api.getLiquidacionesPorTecnico('TEC-001'));
    http.expectOne('/api/tecnicos/me/liquidaciones').flush([liquidacionDto()]);
    expect((await promise)[0].montoServicio).toBe(100000);
  });

  it('getLiquidacionesPendientesAdmin traduce la lista', async () => {
    const promise = firstValueFrom(api.getLiquidacionesPendientesAdmin());
    http.expectOne('/api/admin/liquidaciones/pendientes').flush([liquidacionDto({ estado: 'EN_VERIFICACION' })]);
    expect((await promise)[0].estado).toBe('EN_VERIFICACION');
  });

  it('getTodasLiquidaciones traduce la lista', async () => {
    const promise = firstValueFrom(api.getTodasLiquidaciones());
    http.expectOne('/api/admin/liquidaciones').flush([liquidacionDto(), liquidacionDto({ id: 'l2' })]);
    expect((await promise).length).toBe(2);
  });

  it('subirComprobante solo envía comprobanteUrl', async () => {
    const promise = firstValueFrom(api.subirComprobante('l1', 'http://img', 'ref-1'));
    const req = http.expectOne('/api/liquidaciones/l1/comprobante');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comprobanteUrl: 'http://img' });
    req.flush(null);
    await promise;
  });

  it('aprobarLiquidacion hace POST', async () => {
    const promise = firstValueFrom(api.aprobarLiquidacion('l1'));
    const req = http.expectOne('/api/admin/liquidaciones/l1/aprobar');
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await promise;
  });

  it('rechazarLiquidacion envía el motivo', async () => {
    const promise = firstValueFrom(api.rechazarLiquidacion('l1', 'comprobante ilegible'));
    const req = http.expectOne('/api/admin/liquidaciones/l1/rechazar');
    expect(req.request.body).toEqual({ motivo: 'comprobante ilegible' });
    req.flush(null);
    await promise;
  });

  it('registrarPago envía montoCobrado y medioPago', async () => {
    const promise = firstValueFrom(api.registrarPago('ot1', 80000, 'TRANSFERENCIA'));
    const req = http.expectOne('/api/liquidaciones/ot/ot1');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ montoCobrado: 80000, medioPago: 'TRANSFERENCIA' });
    req.flush(liquidacionDto({ montoCobrado: 80000, medioPago: 'TRANSFERENCIA' }));
    expect((await promise).montoServicio).toBe(80000);
  });

  it('registrarPago en modo mock calcula la comisión', async () => {
    config.setUseMocks(true);
    const liq = await firstValueFrom(api.registrarPago('ot1', 100000, 'EFECTIVO'));
    expect(liq.id).toBe('LIQ-ot1');
    expect(liq.comision).toBe(15000);
    expect(liq.estado).toBe('PENDIENTE_CONSIGNACION');
  });
});
