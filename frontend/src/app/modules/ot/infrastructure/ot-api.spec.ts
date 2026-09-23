import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { OtApi } from './ot-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { OtApiResponse } from '../../../core/shared/infrastructure/api/backend.dto';

function otDto(overrides: Partial<OtApiResponse> = {}): OtApiResponse {
  return {
    id: 'ot1',
    clienteId: 'c1',
    tecnicoId: null,
    estado: 'SOLICITADA',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    direccion: 'calle 1',
    radioKm: 10,
    creadaEn: '2026-01-01T00:00:00',
    canceladaPor: null,
    motivoCancelacion: null,
    tarifaVisita: null,
    diagnostico: null,
    presupuesto: null,
    latitud: 4.6,
    longitud: -74.1,
    clienteNombre: 'Ana',
    tecnicoNombre: null,
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

describe('OtApi', () => {
  let api: OtApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(OtApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('getOtById traduce la respuesta', async () => {
    const promise = firstValueFrom(api.getOtById('ot1'));
    const req = http.expectOne('/api/ot/ot1');
    expect(req.request.method).toBe('GET');
    req.flush(otDto());
    expect((await promise)?.punto).toEqual({ latitud: 4.6, longitud: -74.1 });
  });

  it('iniciarDesplazamiento hace POST sin cuerpo', async () => {
    const promise = firstValueFrom(api.iniciarDesplazamiento('ot1'));
    const req = http.expectOne('/api/ot/ot1/iniciar-desplazamiento');
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await promise;
  });

  it('iniciarDiagnostico lanza en modo real (pendiente backend)', async () => {
    await expect(firstValueFrom(api.iniciarDiagnostico('ot1'))).rejects.toThrow('Pendiente en el backend');
  });

  it('registrarDiagnostico normaliza el body', async () => {
    const promise = firstValueFrom(
      api.registrarDiagnostico('ot1', { diagnostico: 'falla', manoDeObra: 1000, repuestos: 500 }),
    );
    const req = http.expectOne('/api/ot/ot1/diagnostico');
    expect(req.request.body).toEqual({
      fallaDetectada: 'falla',
      observaciones: undefined,
      costoManoObra: 1000,
      costoRepuestos: 500,
      insumos: [],
    });
    req.flush(null);
    await promise;
  });

  it('finalizarOt y cancelarOt usan sus endpoints', async () => {
    const finalizar = firstValueFrom(api.finalizarOt('ot1', 'EFECTIVO'));
    http.expectOne('/api/ot/ot1/finalizar').flush(null);
    await finalizar;

    const cancelar = firstValueFrom(api.cancelarOt('ot1', 'ya no aplica', 'CLIENTE'));
    const req = http.expectOne('/api/ot/ot1/cancelar');
    expect(req.request.body).toEqual({ motivo: 'ya no aplica' });
    req.flush(null);
    await cancelar;
  });

  it('getTecnicoUbicacion mapea el punto', async () => {
    const promise = firstValueFrom(api.getTecnicoUbicacion('ot1'));
    http.expectOne('/api/ot/ot1/tecnico-ubicacion').flush({ latitud: 1, longitud: 2, extra: 'x' });
    expect(await promise).toEqual({ latitud: 1, longitud: 2 });
  });

  it('getTecnicoUbicacion devuelve null ante error', async () => {
    const promise = firstValueFrom(api.getTecnicoUbicacion('ot1'));
    http
      .expectOne('/api/ot/ot1/tecnico-ubicacion')
      .flush('boom', { status: 404, statusText: 'Not Found' });
    expect(await promise).toBeNull();
  });

  it('getHistorial traduce la lista', async () => {
    const promise = firstValueFrom(api.getHistorial('ot1'));
    http.expectOne('/api/ot/ot1/historial').flush([
      { estadoOrigen: 'SOLICITADA', estadoDestino: 'ASIGNADA', actor: 'SISTEMA', ocurridoEn: '2026-01-01', motivo: null },
    ]);
    const historial = await promise;
    expect(historial[0].estado).toBe('ASIGNADA');
    expect(historial[0].motivo).toBeUndefined();
  });

  it('en modo mock lee y avanza el estado de la OT', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const ot = await firstValueFrom(api.getOtById('OT-2026-001'));
    expect(ot?.id).toBe('OT-2026-001');

    await firstValueFrom(api.iniciarDesplazamiento('OT-2026-001'));
    expect(mockDb.ordenesTrabajo().find(o => o.id === 'OT-2026-001')?.estado).toBe('EN_CAMINO');

    expect(await firstValueFrom(api.getHistorial('OT-2026-001'))).toEqual([]);
  });
});
