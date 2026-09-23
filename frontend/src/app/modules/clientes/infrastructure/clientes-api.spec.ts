import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ClientesApi } from './clientes-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { OtApiResponse } from '../../../core/shared/infrastructure/api/backend.dto';
import { OtRequest } from '../../../core/shared/domain/models/common.models';

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

const otRequest: OtRequest = {
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  direccion: 'calle 1',
  latitud: 4.6,
  longitud: -74.1,
};

describe('ClientesApi', () => {
  let api: ClientesApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ClientesApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('crearOt hace POST /api/ot con el body normalizado', async () => {
    const promise = firstValueFrom(api.crearOt(otRequest, 'c1', 'Ana'));
    const req = http.expectOne('/api/ot');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      categoriaServicio: 'REFRIGERACION',
      descripcionFalla: 'no enfría',
      evidenciaUrls: undefined,
      direccion: 'calle 1',
      latitud: 4.6,
      longitud: -74.1,
    });
    req.flush(otDto());
    expect((await promise).id).toBe('ot1');
  });

  it('getOtsPorCliente traduce la lista', async () => {
    const promise = firstValueFrom(api.getOtsPorCliente('c1'));
    http.expectOne('/api/clientes/me/ots').flush([otDto(), otDto({ id: 'ot2' })]);
    expect((await promise).length).toBe(2);
  });

  it('getOtById traduce la respuesta', async () => {
    const promise = firstValueFrom(api.getOtById('ot1'));
    http.expectOne('/api/ot/ot1').flush(otDto());
    expect((await promise)?.clienteNombre).toBe('Ana');
  });

  it('aprobar y rechazar presupuesto usan sus endpoints', async () => {
    const aprobar = firstValueFrom(api.aprobarPresupuesto('ot1'));
    http.expectOne('/api/ot/ot1/presupuesto/aprobar').flush(null);
    await aprobar;

    const rechazar = firstValueFrom(api.rechazarPresupuesto('ot1', 'caro'));
    const req = http.expectOne('/api/ot/ot1/presupuesto/rechazar');
    expect(req.request.body).toEqual({ motivo: 'caro' });
    req.flush(null);
    await rechazar;
  });

  it('aprobarDiagnostico y rechazarDiagnostico delegan al presupuesto', async () => {
    const aprobar = firstValueFrom(api.aprobarDiagnostico('ot1'));
    http.expectOne('/api/ot/ot1/presupuesto/aprobar').flush(null);
    await aprobar;

    const rechazar = firstValueFrom(api.rechazarDiagnostico('ot1', 'no'));
    http.expectOne('/api/ot/ot1/presupuesto/rechazar').flush(null);
    await rechazar;
  });

  it('cancelarOt envía el motivo', async () => {
    const promise = firstValueFrom(api.cancelarOt('ot1', 'ya no'));
    const req = http.expectOne('/api/ot/ot1/cancelar');
    expect(req.request.body).toEqual({ motivo: 'ya no' });
    req.flush(null);
    await promise;
  });

  it('calificarServicio lanza en modo real (pendiente backend)', async () => {
    await expect(firstValueFrom(api.calificarServicio('ot1', 5, 'ok'))).rejects.toThrow('Pendiente en el backend');
  });

  it('registrarCliente hace POST /api/clientes', async () => {
    const promise = firstValueFrom(
      api.registrarCliente({
        nombre: 'Ana',
        correo: 'a@x.co',
        password: 'p',
        tipoCliente: 'B2C',
        calle: 'calle 1',
        ciudad: 'Cúcuta',
        aceptaHabeasData: true,
      }),
    );
    const req = http.expectOne('/api/clientes');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'cl1',
      usuarioId: 1,
      nombre: 'Ana',
      correo: 'a@x.co',
      telefono: null,
      fotoUrl: null,
      tipoCliente: 'B2C',
      direccion: { calle: 'calle 1', ciudad: 'Cúcuta', barrio: null, ubicacion: null },
      activo: true,
    });
    expect((await promise).id).toBe('cl1');
  });

  it('actualizarUbicacion hace PUT /api/clientes/me/ubicacion', async () => {
    const promise = firstValueFrom(api.actualizarUbicacion({ latitud: 1, longitud: 2 }));
    const req = http.expectOne('/api/clientes/me/ubicacion');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
    await promise;
  });

  it('abrirDisputa traduce la respuesta', async () => {
    const promise = firstValueFrom(api.abrirDisputa('ot1', 'cobro excesivo'));
    const req = http.expectOne('/api/disputas/ot/ot1');
    expect(req.request.body).toEqual({ motivo: 'cobro excesivo' });
    req.flush({
      id: 'd1',
      otId: 'ot1',
      motivo: 'cobro excesivo',
      estado: 'ABIERTA',
      resolucion: null,
      creadaEn: '2026-01-01T00:00:00',
      resueltaEn: null,
      clienteNombre: 'Ana',
      tecnicoNombre: null,
    });
    expect((await promise).estado).toBe('ABIERTA');
  });

  it('en modo mock registrarCliente y abrirDisputa devuelven datos simulados', async () => {
    config.setUseMocks(true);
    const cliente = await firstValueFrom(
      api.registrarCliente({
        nombre: 'Ana',
        correo: 'a@x.co',
        password: 'p',
        tipoCliente: 'B2C',
        calle: 'calle 1',
        ciudad: 'Cúcuta',
        aceptaHabeasData: true,
      }),
    );
    expect(cliente.id).toContain('cliente-mock-');

    const disputa = await firstValueFrom(api.abrirDisputa('ot1', 'motivo'));
    expect(disputa.id).toContain('disputa-mock-');
    expect(disputa.estado).toBe('ABIERTA');
  });
});
