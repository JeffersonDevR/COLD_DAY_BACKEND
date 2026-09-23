import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from './admin-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { MetricasAdminApiResponse } from '../../../core/shared/infrastructure/api/backend.dto';

function metricasDto(): MetricasAdminApiResponse {
  return {
    otsEnEjecucion: 4,
    otsPorEstado: {},
    tecnicosVerificados: 2,
    tecnicosTotales: 5,
    tecnicosBloqueadosPorLiquidacion: 0,
    tecnicosDisponibles: 3,
    tiempoPromedioAsignacionSegundos: 90,
    disputasAbiertas: 1,
    liquidacionesPendientesVerificacion: 0,
    totalRecaudoMesCop: 1000,
    comisionesMesCop: 150,
    distribucionCategorias: [],
    historicoSemanal: [],
  };
}

describe('AdminApi', () => {
  let api: AdminApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AdminApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('getMetricas traduce las métricas', async () => {
    const promise = firstValueFrom(api.getMetricas());
    http.expectOne('/api/admin/metricas').flush(metricasDto());
    const metricas = await promise;
    expect(metricas.serviciosEnEjecucion).toBe(4);
    expect(metricas.tiempoPromedioRespuestaMin).toBe(1.5);
  });

  it('getTodasOts traduce la lista', async () => {
    const promise = firstValueFrom(api.getTodasOts());
    http.expectOne('/api/admin/ot').flush([
      {
        id: 'ot1',
        clienteId: 'c1',
        tecnicoId: null,
        estado: 'SOLICITADA',
        categoriaServicio: 'REFRIGERACION',
        descripcionFalla: 'x',
        direccion: 'y',
        radioKm: 10,
        creadaEn: '2026-01-01T00:00:00',
        canceladaPor: null,
        motivoCancelacion: null,
        tarifaVisita: null,
        diagnostico: null,
        presupuesto: null,
        latitud: null,
        longitud: null,
        clienteNombre: null,
        tecnicoNombre: null,
      },
    ]);
    expect((await promise)[0].id).toBe('ot1');
  });

  it('getDisputasAbiertas y getTodasDisputas traducen', async () => {
    const abiertas = firstValueFrom(api.getDisputasAbiertas());
    http.expectOne('/api/admin/disputas/abiertas').flush([]);
    expect(await abiertas).toEqual([]);

    const todas = firstValueFrom(api.getTodasDisputas());
    http.expectOne('/api/admin/disputas').flush([
      {
        id: 'd1',
        otId: 'ot1',
        motivo: 'x',
        estado: 'ABIERTA',
        resolucion: null,
        creadaEn: '2026-01-01T00:00:00',
        resueltaEn: null,
        clienteNombre: null,
        tecnicoNombre: null,
      },
    ]);
    expect((await todas)[0].id).toBe('d1');
  });

  it('resolverDisputa envía conAcuerdo y resolucion', async () => {
    const promise = firstValueFrom(api.resolverDisputa('d1', 'acuerdo total', true, 'Admin'));
    const req = http.expectOne('/api/admin/disputas/d1/resolver');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ conAcuerdo: true, resolucion: 'acuerdo total' });
    req.flush(null);
    await promise;
  });

  it('validarDocumentacionTecnico aprueba con APROBAR', async () => {
    const promise = firstValueFrom(api.validarDocumentacionTecnico('TEC-001', 'APROBADO'));
    const req = http.expectOne('/api/tecnicos/TEC-001/validacion');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ accion: 'APROBAR' });
    req.flush(null);
    await promise;
  });

  it('validarDocumentacionTecnico rechaza con motivo', async () => {
    const promise = firstValueFrom(api.validarDocumentacionTecnico('TEC-001', 'RECHAZADO', 'documentos ilegibles'));
    const req = http.expectOne('/api/tecnicos/TEC-001/validacion');
    expect(req.request.body).toEqual({ accion: 'RECHAZAR', motivo: 'documentos ilegibles' });
    req.flush(null);
    await promise;
  });

  it('en modo mock calcula métricas desde la base simulada', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const metricas = await firstValueFrom(api.getMetricas());
    expect(metricas.totalRecaudoMesCop).toBeGreaterThan(0);
    expect(await firstValueFrom(api.getTodasOts())).toEqual(mockDb.ordenesTrabajo());
  });
});
