import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { TecnicosApi } from './tecnicos-api';
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

describe('TecnicosApi', () => {
  let api: TecnicosApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TecnicosApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('registrar hace POST /api/tecnicos', async () => {
    const promise = firstValueFrom(
      api.registrar({
        nombre: 'Juan',
        correo: 'j@x.co',
        password: 'p',
        numeroIdentificacion: '123',
        categoriasServicio: ['REFRIGERACION'],
        aceptaHabeasData: true,
      }),
    );
    const req = http.expectOne('/api/tecnicos');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 't1', nombre: 'Juan' });
    expect((await promise).id).toBe('t1');
  });

  it('getMisOts traduce la lista', async () => {
    const promise = firstValueFrom(api.getMisOts());
    http.expectOne('/api/tecnicos/me/ots').flush([otDto()]);
    expect((await promise)[0].id).toBe('ot1');
  });

  it('getMisDocumentos traduce documentos', async () => {
    const promise = firstValueFrom(api.getMisDocumentos());
    http.expectOne('/api/tecnicos/me/documentos').flush([
      { id: 1, tecnicoId: { valor: 't1' }, tipo: 'CEDULA', fechaVencimiento: null, vigente: true },
    ]);
    const docs = await promise;
    expect(docs[0].id).toBe('1');
    expect(docs[0].semaforo).toBe('VERDE');
  });

  it('getTecnicosCercanos envía lat, lng, radioKm y categoria', async () => {
    const promise = firstValueFrom(api.getTecnicosCercanos({ latitud: 4.6, longitud: -74.1 }, 8, 'REFRIGERACION'));
    const req = http.expectOne((r) => r.url === '/api/tecnicos/cercanos');
    expect(req.request.params.get('lat')).toBe('4.6');
    expect(req.request.params.get('lng')).toBe('-74.1');
    expect(req.request.params.get('radioKm')).toBe('8');
    expect(req.request.params.get('categoria')).toBe('REFRIGERACION');
    req.flush([
      {
        id: 't1',
        nombre: 'Juan',
        telefono: null,
        fotoUrl: null,
        categoriasServicio: ['REFRIGERACION'],
        distanciaKm: 2,
        latitud: 4.6,
        longitud: -74.1,
        disponible: true,
      },
    ]);
    expect((await promise)[0].especialidad).toBe('REFRIGERACION');
  });

  it('getTecnicosCercanos omite categoria si no viene', async () => {
    const promise = firstValueFrom(api.getTecnicosCercanos({ latitud: 1, longitud: 2 }, 5));
    const req = http.expectOne((r) => r.url === '/api/tecnicos/cercanos');
    expect(req.request.params.has('categoria')).toBe(false);
    req.flush([]);
    expect(await promise).toEqual([]);
  });

  it('getTecnicos traduce la lista', async () => {
    const promise = firstValueFrom(api.getTecnicos());
    http.expectOne('/api/tecnicos').flush([
      {
        id: 't1',
        usuarioId: 6,
        nombre: 'Juan',
        correo: 'j@x.co',
        telefono: null,
        numeroIdentificacion: '123',
        fotoUrl: null,
        categoriasServicio: ['REFRIGERACION'],
        estadoOperativo: 'DISPONIBLE',
        estadoValidacion: 'APROBADO',
        motivoRechazoValidacion: null,
        certificaciones: [],
        activo: true,
      },
    ]);
    expect((await promise)[0].nombre).toBe('Juan');
  });

  it('getTecnicoPorUsuarioId busca por usuarioId', async () => {
    const promise = firstValueFrom(api.getTecnicoPorUsuarioId(7));
    http.expectOne('/api/tecnicos').flush([
      {
        id: 't1',
        usuarioId: 6,
        nombre: 'Juan',
        correo: 'j@x.co',
        telefono: null,
        numeroIdentificacion: '123',
        fotoUrl: null,
        categoriasServicio: [],
        estadoOperativo: 'DISPONIBLE',
        estadoValidacion: 'APROBADO',
        motivoRechazoValidacion: null,
        certificaciones: [],
        activo: true,
      },
      {
        id: 't2',
        usuarioId: 7,
        nombre: 'Diego',
        correo: 'd@x.co',
        telefono: null,
        numeroIdentificacion: '456',
        fotoUrl: null,
        categoriasServicio: [],
        estadoOperativo: 'DISPONIBLE',
        estadoValidacion: 'APROBADO',
        motivoRechazoValidacion: null,
        certificaciones: [],
        activo: true,
      },
    ]);
    expect((await promise)?.id).toBe('t2');
  });

  it('getOfertasParaTecnico compone la OT anidada', async () => {
    const promise = firstValueFrom(api.getOfertasParaTecnico('TEC-001'));
    http.expectOne('/api/tecnicos/me/ofertas').flush([
      {
        id: 'of1',
        otId: 'ot1',
        tecnicoId: 'TEC-001',
        radioKm: 10,
        estado: 'PENDIENTE',
        creadaEn: '2026-01-01T00:00:00',
        expiraEn: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    http.expectOne('/api/ot/ot1').flush(otDto());
    const ofertas = await promise;
    expect(ofertas[0].otId).toBe('ot1');
    expect(ofertas[0].ot.id).toBe('ot1');
  });

  it('getOfertasParaTecnico no consulta OTs si no hay ofertas', async () => {
    const promise = firstValueFrom(api.getOfertasParaTecnico('TEC-001'));
    http.expectOne('/api/tecnicos/me/ofertas').flush([]);
    expect(await promise).toEqual([]);
  });

  it('aceptarOferta devuelve true', async () => {
    const promise = firstValueFrom(api.aceptarOferta('of1', 'TEC-001'));
    const req = http.expectOne('/api/ofertas/of1/aceptar');
    expect(req.request.method).toBe('POST');
    req.flush(otDto());
    expect(await promise).toBe(true);
  });

  it('aceptarOt lanza en modo real (pendiente backend)', async () => {
    await expect(firstValueFrom(api.aceptarOt('ot1', 'TEC-001'))).rejects.toThrow('Pendiente en el backend');
  });

  it('cambiarEstadoOperativo envía estadoOperativo y delega el alias', async () => {
    const promise = firstValueFrom(api.cambiarEstadoOperativo('TEC-001', 'OCUPADO'));
    const req = http.expectOne('/api/tecnicos/TEC-001/estado');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ estadoOperativo: 'OCUPADO' });
    req.flush({});
    expect(await promise).toBe(true);

    const alias = firstValueFrom(api.actualizarEstadoOperativo('TEC-001', 'DISPONIBLE'));
    http.expectOne('/api/tecnicos/TEC-001/estado').flush({});
    expect(await alias).toBe(true);
  });

  it('llegarADomicilio lanza en modo real (pendiente backend)', async () => {
    await expect(firstValueFrom(api.llegarADomicilio('ot1'))).rejects.toThrow('Pendiente en el backend');
  });

  it('registrarDiagnostico, finalizarServicio y subirDocumento usan sus endpoints', async () => {
    const diag = firstValueFrom(api.registrarDiagnostico('ot1', { fallaDetectada: 'x' }));
    const diagReq = http.expectOne('/api/ot/ot1/diagnostico');
    expect(diagReq.request.body).toMatchObject({ fallaDetectada: 'x', costoManoObra: 0, costoRepuestos: 0 });
    diagReq.flush(null);
    await diag;

    const fin = firstValueFrom(api.finalizarServicio('ot1', 'EFECTIVO'));
    http.expectOne('/api/ot/ot1/finalizar').flush(null);
    await fin;

    const doc = firstValueFrom(api.subirDocumento('TEC-001', 'CEDULA', 'url', '2027-01-01'));
    const docReq = http.expectOne('/api/tecnicos/TEC-001/documentos');
    expect(docReq.request.body).toEqual({ tipo: 'CEDULA', fechaVencimiento: '2027-01-01' });
    docReq.flush({ id: 1, tecnicoId: { valor: 'TEC-001' }, tipo: 'CEDULA', fechaVencimiento: null, vigente: true });
    expect(await doc).toBeUndefined();
  });

  it('actualizarUbicacion hace PUT /api/tecnicos/me/ubicacion', async () => {
    const promise = firstValueFrom(api.actualizarUbicacion({ latitud: 1, longitud: 2 }));
    const req = http.expectOne('/api/tecnicos/me/ubicacion');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
    await promise;
  });

  it('en modo mock resuelve ofertas y estado del técnico', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    expect(await firstValueFrom(api.getMisOts())).toEqual([]);
    expect(await firstValueFrom(api.getTecnicos())).toEqual(mockDb.tecnicos());

    const ofertas = await firstValueFrom(api.getOfertasParaTecnico('TEC-001'));
    expect(ofertas.length).toBeGreaterThan(0);

    const ok = await firstValueFrom(api.cambiarEstadoOperativo('TEC-001', 'OCUPADO'));
    expect(ok).toBe(true);
  });
});
