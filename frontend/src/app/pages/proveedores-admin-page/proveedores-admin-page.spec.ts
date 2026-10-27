import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProveedoresAdminPage } from './proveedores-admin-page';
import { AdminApi } from '../../core/service/admin-api';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { ProveedorResponse } from '../../core/models/common.models';

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

function setup(opciones: { validarError?: unknown; proveedores?: ProveedorResponse[]; getProveedores?: ReturnType<typeof vi.fn> } = {}) {
  const adminApi = {
    getProveedores: opciones.getProveedores ?? vi.fn(() => of(opciones.proveedores ?? [proveedor])),
  };
  const proveedoresApi = {
    validarDocumentacion: vi.fn(() =>
      opciones.validarError ? throwError(() => opciones.validarError) : of(undefined)
    ),
  };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ProveedoresAdminPage],
    providers: [
      { provide: AdminApi, useValue: adminApi },
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
    expect(fixture.nativeElement.textContent).toContain('Aún no hay proveedores registrados.');
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

  it('si el proveedor ya está aprobado muestra "Validado" y oculta las acciones', () => {
    const { fixture } = setup({ proveedores: [proveedorAprobado] });

    expect(fixture.nativeElement.textContent).toContain('Validado');
    expect(textosDeBotones(fixture)).not.toContain('Aprobar');
    expect(textosDeBotones(fixture)).not.toContain('Rechazar');
  });
});
