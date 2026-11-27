import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProveedoresAdminPage } from './proveedores-admin-page';
import { AdminApi } from '../../core/service/admin-api';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { IncumplimientoInsumo, ProveedorResponse, Rol } from '../../core/models/common.models';
import { AuthService } from '../../core/service/auth.service';

const proveedor: ProveedorResponse = {
  id: 'PROV-1',
  razonSocial: 'Insumos del Norte SAS',
  nit: '900123456-7',
  telefono: '3001234567',
  activo: true,
  estadoValidacion: 'PENDIENTE',
};

const proveedorAprobado: ProveedorResponse = {
  ...proveedor,
  id: 'PROV-2',
  razonSocial: 'Repuestos El Frío SAS',
  estadoValidacion: 'APROBADO',
};

/** Mensaje humano esperado para el 409 de expediente incompleto/vencido. */
const MENSAJE_409 =
  'El expediente del proveedor no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo.';

function setup(opciones: { validarError?: unknown; proveedores?: ProveedorResponse[]; getProveedores?: ReturnType<typeof vi.fn>; getIncumplimientos?: ReturnType<typeof vi.fn>; getDocumentos?: ReturnType<typeof vi.fn>; rol?: Rol } = {}) {
  const adminApi = {
    getProveedores: opciones.getProveedores ?? vi.fn(() => of(opciones.proveedores ?? [proveedor])),
  };
  const proveedoresApi = {
    getDocumentos: opciones.getDocumentos ?? vi.fn(() => of([])),
    getIncumplimientos: opciones.getIncumplimientos ?? vi.fn(() => of([])),
    validarDocumentacion: vi.fn(() =>
      opciones.validarError ? throwError(() => opciones.validarError) : of(undefined)
    ),
  };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ProveedoresAdminPage],
    providers: [
      { provide: AdminApi, useValue: adminApi },
      { provide: AuthService, useValue: { userRoles: () => new Set<Rol>([opciones.rol ?? 'ADMINISTRADOR']) } },
      { provide: ProveedoresApi, useValue: proveedoresApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture: ComponentFixture<ProveedoresAdminPage> = TestBed.createComponent(ProveedoresAdminPage);
  fixture.detectChanges();
  return { fixture, adminApi, proveedoresApi, toast };
}

function textosDeBotones(fixture: ComponentFixture<ProveedoresAdminPage>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
    .map((boton) => boton.textContent?.trim() ?? '');
}

describe('ProveedoresAdminPage', () => {
  it('ya no muestra el formulario de alta de proveedores', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Nuevo proveedor');
  });

  it('muestra los documentos que declaró cada proveedor pendiente', () => {
    const getDocumentos = vi.fn(() => of([{ id: 3, tipo: 'CAMARA_COMERCIO', fechaVencimiento: '2027-03-01' }]));
    const { fixture } = setup({ getDocumentos });

    const texto = fixture.nativeElement.textContent;
    expect(getDocumentos).toHaveBeenCalledWith('PROV-1');
    expect(texto).toContain('CAMARA COMERCIO');
    expect(texto).toContain('Vence: 2027-03-01');
  });

  it('distingue sin documentos de un fallo al cargarlos', () => {
    expect(setup().fixture.nativeElement.textContent).toContain('No ha declarado documentos.');
    TestBed.resetTestingModule();

    const fallo = setup({ getDocumentos: vi.fn(() => throwError(() => new Error('sin red'))) });
    expect(fallo.fixture.nativeElement.textContent).toContain('No pudimos cargar los documentos.');
    expect(fallo.fixture.nativeElement.textContent).not.toContain('No ha declarado documentos.');
  });

  it('Recursos Humanos no ve ni pide los incumplimientos', () => {
    const { fixture, proveedoresApi } = setup({ rol: 'RECURSOS_HUMANOS' });

    expect(proveedoresApi.getIncumplimientos).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Incumplimientos de ETA');
  });

  it('lista los proveedores con su estado de validación', () => {
    const { fixture } = setup();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Insumos del Norte SAS');
    expect(texto).toContain('NIT: 900123456-7');
    expect(texto).toContain('PENDIENTE');
  });

  it('avisa si los proveedores no cargan y reintenta', () => {
    const getProveedores = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of([proveedor]));
    const { fixture } = setup({ getProveedores });

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los proveedores.');
    // Un fallo no es un listado vacío: el estado vacío solo aplica a una carga exitosa sin filas.
    expect(fixture.nativeElement.textContent).not.toContain('Aún no hay proveedores registrados.');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getProveedores).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.proveedores().length).toBe(1);
  });

  it('muestra el estado vacío solo cuando la carga salió bien y no hay filas', () => {
    const { fixture } = setup({ proveedores: [] });

    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No hay proveedores pendientes de validación.');
  });

  it('ante un 400 de documentación incompleta explica qué hacer', () => {
    const { fixture, toast } = setup({
      validarError: new ApiHttpError('Documentacion incompleta del proveedor PROV-1', 400),
    });

    fixture.componentInstance.aprobar(proveedor);

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo aprobar al proveedor',
      'El proveedor no tiene documentos cargados o alguno está vencido. Pídele que suba su documentación vigente antes de validarlo.',
    );
  });

  it('aprueba al proveedor sin motivo y recarga el listado', () => {
    const { fixture, adminApi, proveedoresApi, toast } = setup();

    fixture.componentInstance.aprobar(proveedor);

    expect(proveedoresApi.validarDocumentacion).toHaveBeenCalledWith('PROV-1', 'APROBAR');
    expect(toast.success).toHaveBeenCalled();
    expect(adminApi.getProveedores).toHaveBeenCalledTimes(2);
  });

  it('confirma el rechazo con motivo y recarga el listado', () => {
    const { fixture, adminApi, proveedoresApi, toast } = setup();
    fixture.componentInstance.abrirModalRechazo(proveedor);
    fixture.componentInstance.motivoCtrl.setValue('RUT vencido');

    fixture.componentInstance.confirmarRechazo();

    expect(proveedoresApi.validarDocumentacion).toHaveBeenCalledWith('PROV-1', 'RECHAZAR', 'RUT vencido');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.proveedorARechazar()).toBeNull();
    expect(adminApi.getProveedores).toHaveBeenCalledTimes(2);
  });

  it('no rechaza con motivo vacío', () => {
    const { fixture, proveedoresApi } = setup();
    fixture.componentInstance.abrirModalRechazo(proveedor);

    fixture.componentInstance.confirmarRechazo();

    expect(proveedoresApi.validarDocumentacion).not.toHaveBeenCalled();
  });

  it('no rechaza con un motivo más corto que el mínimo', () => {
    const { fixture, proveedoresApi } = setup();
    fixture.componentInstance.abrirModalRechazo(proveedor);
    fixture.componentInstance.motivoCtrl.setValue('x');

    fixture.componentInstance.confirmarRechazo();

    expect(proveedoresApi.validarDocumentacion).not.toHaveBeenCalled();
  });

  it('ante un 409 avisa con copy humana y no recarga el listado', () => {
    const { fixture, adminApi, toast } = setup({
      validarError: new ApiHttpError('Documentacion incompleta del proveedor PROV-1', 409),
    });

    fixture.componentInstance.aprobar(proveedor);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo aprobar al proveedor', MENSAJE_409);
    // Solo la carga inicial del constructor: el fallo no dispara refetch.
    expect(adminApi.getProveedores).toHaveBeenCalledTimes(1);
  });

  it('un proveedor ya aprobado sale de la lista y solo quedan los pendientes', () => {
    const { fixture } = setup({ proveedores: [proveedorAprobado, proveedor] });

    const texto = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Repuestos El Frío SAS');
    expect(texto).toContain('Insumos del Norte SAS');
    expect(textosDeBotones(fixture).filter((t) => t.includes('Aprobar'))).toHaveLength(1);
  });

  describe('Incumplimientos de ETA', () => {
    const fila = (id: string, proveedorId: string, razonSocial: string): IncumplimientoInsumo => ({
      id,
      proveedorId,
      razonSocial,
      requerimientoId: 'REQ-' + id,
      etaMinutos: 30,
      aceptadaEn: '2026-09-15T09:00:00Z',
      reemplazadoEn: '2026-09-15T09:40:00Z',
    });
    const q = (f: ComponentFixture<ProveedoresAdminPage>, id: string) =>
      f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    it('lista cada incumplimiento y el total por proveedor', () => {
      const { fixture } = setup({
        getIncumplimientos: vi.fn(() =>
          of([fila('1', 'P1', 'Frío SAS'), fila('2', 'P2', 'Norte SAS'), fila('3', 'P1', 'Frío SAS')]),
        ),
      });

      expect(fixture.nativeElement.textContent).toContain('Incumplimientos de ETA');
      expect(fixture.nativeElement.querySelectorAll('[data-testid="incumplimiento"]').length).toBe(3);
      const totales = q(fixture, 'incumplimientos-totales')!.textContent!.replace(/\s+/g, ' ');
      expect(totales).toContain('Frío SAS: 2');
      expect(totales).toContain('Norte SAS: 1');
      expect(q(fixture, 'incumplimiento')!.textContent).toContain('30 min');
      expect(q(fixture, 'incumplimientos-tope')).toBeNull();
    });

    it('sin incumplimientos lo dice', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent).toContain('No hay incumplimientos registrados');
    });

    it('con 200 filas avisa que solo se muestran las más recientes', () => {
      const { fixture } = setup({
        getIncumplimientos: vi.fn(() => of(Array.from({ length: 200 }, (_, i) => fila(String(i), 'P1', 'Frío SAS')))),
      });
      expect(q(fixture, 'incumplimientos-tope')!.textContent).toContain('Se muestran los 200 más recientes');
    });

    it('si falla esta sección, la bandeja de validación sigue disponible', () => {
      const { fixture } = setup({ getIncumplimientos: vi.fn(() => throwError(() => new Error('sin red'))) });

      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los incumplimientos.');
      expect(fixture.nativeElement.textContent).toContain('Insumos del Norte SAS');
    });
  });
});
