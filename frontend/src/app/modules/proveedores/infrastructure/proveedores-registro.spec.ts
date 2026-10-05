import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ProveedoresApi } from './proveedores-api';
import { ProveedorRegistroService } from './proveedor-registro.service';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { DocumentoProveedorApiResponse, ProveedorApiResponse } from '../../../core/shared/infrastructure/api/backend.dto';
import { ProveedorRequest } from '../../../core/shared/domain/models/common.models';

/**
 * El alta pública del proveedor (POST /api/proveedores) y su expediente.
 *
 * Dos invariantes que esta suite blinda, y que el resto del portal ya daba por
 * ciertas sin haberSurface:
 *
 * 1. El request NO lleva `rol`. El endpoint es público, así que un `rol` en el
 *    cuerpo sería la vía trivial de escalada de privilegios; el servidor lo
 *    deriva y el frontend no ofrece ni el campo ni la tentación.
 * 2. La respuesta trae `estadoValidacion: 'PENDIENTE'`. V8 dejó la columna sin
 *    DEFAULT, así que un proveedor recién registrado nace pendiente y no puede
 *    tomar insumos hasta que un administrador lo apruebe.
 */
function altaValida(overrides: Partial<ProveedorRequest> = {}): ProveedorRequest {
  return {
    nombre: 'Ana Proveedor',
    correo: 'ana@proveedor.co',
    password: 'secreto123',
    telefono: '3105550001',
    razonSocial: 'Suministros del Norte S.A.S.',
    nit: '900123456-1',
    aceptaHabeasData: true,
    ...overrides,
  };
}

function respuestaAlta(overrides: Partial<ProveedorApiResponse> = {}): ProveedorApiResponse {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    usuarioId: 42,
    razonSocial: 'Suministros del Norte S.A.S.',
    nit: '900123456-1',
    telefono: '3105550001',
    activo: true,
    creadoEn: '2026-09-14T10:00:00Z',
    estadoValidacion: 'PENDIENTE',
    ...overrides,
  };
}

describe('ProveedoresApi - alta publica y expediente', () => {
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
    window.sessionStorage.clear();
  });

  afterEach(() => http.verify());

  it('registrar hace POST /api/proveedores sin mandar ningun rol', async () => {
    const payload = altaValida();
    const promise = firstValueFrom(api.registrar(payload));
    const req = http.expectOne('/api/proveedores');

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    // El rol no viaja: lo deriva el servidor (Rol.PROVEEDOR en el caso de uso).
    expect(Object.keys(req.request.body as object)).not.toContain('rol');

    req.flush(respuestaAlta());

    const creado = await promise;
    expect(creado.razonSocial).toBe('Suministros del Norte S.A.S.');
    expect(creado.estadoValidacion).toBe('PENDIENTE');
  });

  it('registrar traduce el estado de validacion cuando el backend aprueba uno existente', async () => {
    const promise = firstValueFrom(api.registrar(altaValida()));
    http.expectOne('/api/proveedores').flush(respuestaAlta({ estadoValidacion: 'APROBADO' }));

    expect((await promise).estadoValidacion).toBe('APROBADO');
  });

  it('registrar propaga el 409 de correo duplicado en el canal de error', async () => {
    const promise = firstValueFrom(api.registrar(altaValida()));
    http.expectOne('/api/proveedores').flush(
      { status: 409, mensaje: 'Ya existe un usuario con ese correo', errores: [] },
      { status: 409, statusText: 'Conflict' }
    );

    await expect(promise).rejects.toThrow();
  });

  it('getMisDocumentos consulta el expediente propio y normaliza el vencimiento nulo', async () => {
    const respuesta: DocumentoProveedorApiResponse[] = [
      { id: 1, tipo: 'RUT', fechaVencimiento: '2027-01-01' },
      { id: 2, tipo: 'CERTIFICADO', fechaVencimiento: null },
    ];
    const promise = firstValueFrom(api.getMisDocumentos());
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.method).toBe('GET');
    req.flush(respuesta);

    const documentos = await promise;
    expect(documentos).toEqual([
      { id: 1, tipo: 'RUT', fechaVencimiento: '2027-01-01' },
      { id: 2, tipo: 'CERTIFICADO', fechaVencimiento: undefined },
    ]);
  });

  it('registrarDocumento envia solo tipo y fecha de vencimiento: no hay upload', async () => {
    const promise = firstValueFrom(api.registrarDocumento('RUT', '2027-01-01'));
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipo: 'RUT', fechaVencimiento: '2027-01-01' });
    expect(req.request.body).not.toHaveProperty('archivoUrl');
    req.flush({ id: 7, tipo: 'RUT', fechaVencimiento: '2027-01-01' });

    expect((await promise).id).toBe(7);
  });

  it('registrarDocumento manda null cuando no hay fecha de vencimiento', async () => {
    const promise = firstValueFrom(api.registrarDocumento('CERTIFICADO'));
    const req = http.expectOne('/api/proveedores/me/documentos');
    expect(req.request.body).toEqual({ tipo: 'CERTIFICADO', fechaVencimiento: null });
    req.flush({ id: 8, tipo: 'CERTIFICADO', fechaVencimiento: null });

    expect((await promise).fechaVencimiento).toBeUndefined();
  });

  it('en modo mock el alta nace PENDIENTE y el expediente queda en el proveedor recien creado', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);

    const creado = await firstValueFrom(api.registrar(altaValida()));
    expect(creado.estadoValidacion).toBe('PENDIENTE');
    expect(mockDb.proveedores().length).toBeGreaterThan(2);

    // Sin documentos, el alta todavía no sirve para aprobar: el expediente arranca vacío.
    expect(await firstValueFrom(api.getMisDocumentos())).toEqual([]);

    await firstValueFrom(api.registrarDocumento('RUT', '2027-01-01'));
    const expediente = await firstValueFrom(api.getMisDocumentos());
    expect(expediente).toEqual([{ id: 1, tipo: 'RUT', fechaVencimiento: '2027-01-01' }]);
  });
});

describe('ProveedorRegistroService', () => {
  let servicio: ProveedorRegistroService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    window.sessionStorage.clear();
    servicio = TestBed.inject(ProveedorRegistroService);
  });

  it('sin alta previa no inventa un estado de validacion', () => {
    expect(servicio.estadoValidacion()).toBeUndefined();
    expect(servicio.registro()).toBeUndefined();
  });

  it('guarda el alta y sobrevive a una recarga de la pagina', () => {
    servicio.guardar({
      id: 'PROV-9',
      usuarioId: 42,
      razonSocial: 'Suministros del Norte S.A.S.',
      nit: '900123456-1',
      estadoValidacion: 'PENDIENTE',
    });

    expect(servicio.estadoValidacion()).toBe('PENDIENTE');

    // Reconstrucción desde sessionStorage: es lo que encuentra la página de
    // documentos cuando el usuario vuelve con F5 tras el redirect del registro.
    const recargado = TestBed.inject(ProveedorRegistroService);
    expect(recargado.registro()?.id).toBe('PROV-9');
  });

  it('limpiar borra el estado para que la sesión nueva no herede el PENDIENTE anterior', () => {
    servicio.guardar({ id: 'PROV-9', razonSocial: 'X', nit: '1', estadoValidacion: 'PENDIENTE' });
    servicio.limpiar();

    expect(servicio.estadoValidacion()).toBeUndefined();
    expect(window.sessionStorage.getItem('coldday.proveedor.registro')).toBeNull();
  });
});
