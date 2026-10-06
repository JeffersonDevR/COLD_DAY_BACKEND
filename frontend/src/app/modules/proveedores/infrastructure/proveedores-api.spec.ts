import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ProveedoresApi } from './proveedores-api';
import { ApiConfig } from '../../../core/service/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  OfertaInsumoApiResponse,
  ProveedorApiResponse,
  SolicitudInsumoApiResponse,
} from '../../../core/models/backend.dto';

function requerimientoDto(overrides: Partial<SolicitudInsumoApiResponse> = {}): SolicitudInsumoApiResponse {
  return {
    id: 'REQ-INSUMO-001',
    otId: 'ot1',
    tecnicoId: 'TEC-001',
    estado: 'ASIGNADO',
    observaciones: null,
    items: [{ descripcion: 'compresor', cantidad: 2 }],
    creadaEn: '2026-09-15T09:40:00Z',
    expiraEn: null,
    resueltaEn: null,
    ...overrides,
  };
}

function ofertaDto(overrides: Partial<OfertaInsumoApiResponse> = {}): OfertaInsumoApiResponse {
  return {
    id: 'OFERTA-INSUMO-001',
    requerimientoId: 'REQ-INSUMO-001',
    proveedorId: 'PROV-001',
    estado: 'PENDIENTE',
    creadaEn: '2026-09-15T09:40:00Z',
    expiraEn: null,
    resueltaEn: null,
    requerimiento: requerimientoDto(),
    ...overrides,
  };
}

function proveedorDto(overrides: Partial<ProveedorApiResponse> = {}): ProveedorApiResponse {
  return {
    id: 'PROV-001',
    usuarioId: 10,
    razonSocial: 'Suministros del Norte S.A.S.',
    nit: '900123456-1',
    telefono: '3105550001',
    activo: true,
    estadoValidacion: 'PENDIENTE',
    creadoEn: '2026-09-15T09:40:00Z',
    ...overrides,
  };
}

const REGISTRO = {
  nombre: 'Ana',
  correo: 'ana@proveedor.co',
  password: 'secreto123',
  telefono: '3105550001',
  razonSocial: 'Suministros del Norte S.A.S.',
  nit: '900123456-1',
  aceptaHabeasData: true,
};

describe('ProveedoresApi', () => {
  let api: ProveedoresApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProveedoresApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('registrar hace POST /api/proveedores', async () => {
    const promise = firstValueFrom(api.registrar(REGISTRO));
    const req = http.expectOne('/api/proveedores');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(REGISTRO);
    req.flush(proveedorDto());
    expect((await promise).razonSocial).toBe('Suministros del Norte S.A.S.');
  });

  it('getMisDocumentos consulta los documentos del proveedor autenticado', async () => {
    const promise = firstValueFrom(api.getMisDocumentos());
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, tipo: 'RUT', fechaVencimiento: '2027-01-01' }]);
    expect(await promise).toEqual([{ id: 1, tipo: 'RUT', fechaVencimiento: '2027-01-01' }]);
  });

  // No existe GET /api/proveedores/me en el backend: no hay endpoint de perfil
  // propio para el proveedor. El estado de perfil/validacion se resuelve
  // localmente desde ProveedorRegistroService (sessionStorage) tras el registro.
  it('registrarDocumento envía tipo y fecha de vencimiento', async () => {
    const promise = firstValueFrom(api.registrarDocumento('RUT', '2027-01-01'));
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipo: 'RUT', fechaVencimiento: '2027-01-01' });
    req.flush({ id: 7, tipo: 'RUT', fechaVencimiento: '2027-01-01' });
    expect((await promise).id).toBe(7);
  });

  it('registrarDocumento tolera documento sin vencimiento', async () => {
    const promise = firstValueFrom(api.registrarDocumento('CERTIFICADO'));
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.body).toEqual({ tipo: 'CERTIFICADO', fechaVencimiento: null });
    req.flush({ id: 8, tipo: 'CERTIFICADO' });
    expect((await promise).fechaVencimiento).toBeUndefined();
  });

  it('getDocumentos consulta los documentos de un proveedor puntual', async () => {
    const promise = firstValueFrom(api.getDocumentos('PROV-001'));
    const req = http.expectOne('/api/proveedores/PROV-001/documentos');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 2, tipo: 'CEDULA' }]);
    expect((await promise)[0].tipo).toBe('CEDULA');
  });

  it('validarDocumentacion hace PATCH con la acción y el motivo', async () => {
    const promise = firstValueFrom(api.validarDocumentacion('PROV-001', 'RECHAZAR', 'documento ilegible'));
    const req = http.expectOne('/api/proveedores/PROV-001/validacion');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ accion: 'RECHAZAR', motivo: 'documento ilegible' });
    req.flush(null);
    expect(await promise).toBeNull();
  });

  it('validarDocumentacion omite el motivo cuando la acción es aprobar', async () => {
    const promise = firstValueFrom(api.validarDocumentacion('PROV-001', 'APROBAR'));
    const req = http.expectOne('/api/proveedores/PROV-001/validacion');
    expect(req.request.body).toEqual({ accion: 'APROBAR', motivo: undefined });
    req.flush(null);
    await promise;
  });

  it('getMisSolicitudes traduce la oferta con su requerimiento embebido', async () => {
    const promise = firstValueFrom(api.getMisSolicitudes());
    http.expectOne('/api/proveedores/me/solicitudes').flush([ofertaDto()]);
    const ofertas = await promise;
    expect(ofertas[0].id).toBe('OFERTA-INSUMO-001');
    expect(ofertas[0].estado).toBe('PENDIENTE');
    expect(ofertas[0].requerimiento?.id).toBe('REQ-INSUMO-001');
    expect(ofertas[0].requerimiento?.items).toEqual([{ descripcion: 'compresor', cantidad: 2 }]);
  });

  it('getMisSolicitudes deja el requerimiento en null cuando la oferta no lo trae', async () => {
    const promise = firstValueFrom(api.getMisSolicitudes());
    http.expectOne('/api/proveedores/me/solicitudes').flush([ofertaDto({ estado: 'RECHAZADO', requerimiento: null })]);
    const ofertas = await promise;
    expect(ofertas[0].requerimiento).toBeNull();
    expect(ofertas[0].creadaEn).toBe('2026-09-15T09:40:00Z');
  });

  it('aceptar hace POST /api/insumos/{id}/aceptar sin cuerpo y traduce el requerimiento', async () => {
    const promise = firstValueFrom(api.aceptar('OFERTA-INSUMO-001'));
    const req = http.expectOne('/api/insumos/OFERTA-INSUMO-001/aceptar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(requerimientoDto({ estado: 'ASIGNADO' }));
    const solicitud = await promise;
    expect(solicitud.estado).toBe('ASIGNADO');
    expect(solicitud.items[0].descripcion).toBe('compresor');
  });

  it('rechazar hace POST /api/insumos/{id}/rechazar y devuelve la oferta rechazada', async () => {
    const promise = firstValueFrom(api.rechazar('OFERTA-INSUMO-001'));
    const req = http.expectOne('/api/insumos/OFERTA-INSUMO-001/rechazar');
    expect(req.request.method).toBe('POST');
    req.flush(ofertaDto({ estado: 'RECHAZADO', resueltaEn: '2026-09-16T10:00:00Z' }));
    const oferta = await promise;
    expect(oferta.estado).toBe('RECHAZADO');
    expect(oferta.resueltaEn).toBe('2026-09-16T10:00:00Z');
  });

  it('entregar hace POST /api/insumos/{id}/entregar y traduce el requerimiento', async () => {
    const promise = firstValueFrom(api.entregar('REQ-INSUMO-001'));
    const req = http.expectOne('/api/insumos/REQ-INSUMO-001/entregar');
    expect(req.request.method).toBe('POST');
    req.flush(requerimientoDto({ estado: 'ENTREGADO' }));
    expect((await promise).estado).toBe('ENTREGADO');
  });

  it('en modo mock resuelve el alta y la consulta de documentos sin tocar HTTP', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);

    const creado = await firstValueFrom(api.registrar(REGISTRO));
    expect(creado.razonSocial).toBe(REGISTRO.razonSocial);
    expect(mockDb.proveedores().length).toBeGreaterThan(1);

    // Sin endpoint de perfil propio (GET /api/proveedores/me no existe): el
    // perfil/estado se lee de ProveedorRegistroService (sessionStorage), no de la API.
    expect(await firstValueFrom(api.getMisDocumentos())).toEqual([]);
    expect(await firstValueFrom(api.getDocumentos('PROV-001'))).toEqual([]);
    expect((await firstValueFrom(api.registrarDocumento('RUT'))).tipo).toBe('RUT');
    expect(await firstValueFrom(api.validarDocumentacion('PROV-001', 'APROBAR'))).toBeUndefined();
  });

  it('en modo mock acepta la oferta y luego entrega el requerimiento asignado', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const pendiente = mockDb.solicitudesProveedor().find((oferta) => oferta.estado === 'PENDIENTE');
    expect(pendiente).toBeDefined();

    const aceptada = await firstValueFrom(api.aceptar(pendiente!.id));
    expect(aceptada.estado).toBe('ASIGNADO');

    const entregada = await firstValueFrom(api.entregar(aceptada.id));
    expect(entregada.estado).toBe('ENTREGADO');
  });

  it('en modo mock rechaza la oferta y la marca como RECHAZADO', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const pendiente = mockDb.solicitudesProveedor().find((oferta) => oferta.estado === 'PENDIENTE')!;

    const rechazada = await firstValueFrom(api.rechazar(pendiente.id));
    expect(rechazada.estado).toBe('RECHAZADO');
    expect(rechazada.resueltaEn).toBeTruthy();
  });

  it('en modo mock entrega el requerimiento que ya venía ACEPTADO en la semilla', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const aceptada = mockDb.solicitudesProveedor().find((oferta) => oferta.estado === 'ACEPTADA')!;

    const entregada = await firstValueFrom(api.entregar(aceptada.requerimiento!.id));
    expect(entregada.estado).toBe('ENTREGADO');
  });

  it('en modo mock entrega las ofertas sembradas sin tocar HTTP', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    expect(await firstValueFrom(api.getMisSolicitudes())).toEqual(mockDb.solicitudesProveedor());
  });

  it('en modo mock entrega el conflicto por el canal de error, no de forma síncrona', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const pendiente = mockDb.solicitudesProveedor().find((oferta) => oferta.estado === 'PENDIENTE')!;
    await firstValueFrom(api.aceptar(pendiente.id));
    await expect(firstValueFrom(api.aceptar(pendiente.id))).rejects.toThrow(/ya tom/);
  });

  it('en modo mock entrega el 404 cuando la oferta no existe', async () => {
    config.setUseMocks(true);
    await expect(firstValueFrom(api.aceptar('OFERTA-INSUMO-999'))).rejects.toThrow(/no existe/);
    await expect(firstValueFrom(api.rechazar('OFERTA-INSUMO-999'))).rejects.toThrow(/no existe/);
    await expect(firstValueFrom(api.entregar('REQ-INSUMO-999'))).rejects.toThrow(/No hay un requerimiento/);
  });
});
