import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { DocumentoProveedorResponse } from '@core/models/common.models';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileToastService } from '../../core/toast.service';
import { DocumentosProveedorPage } from './documentos-proveedor.page';

function setup({
  documentos = [] as DocumentoProveedorResponse[],
  estado = 'PENDIENTE' as 'PENDIENTE' | 'APROBADO' | 'RECHAZADO',
  razonSocial = 'Suministros del Norte',
  nit = '900123456-1',
} = {}) {
  const perfil = { id: 'PROV-1', razonSocial, nit, activo: true, estadoValidacion: estado };
  const api = {
    getMiPerfil: vi.fn(() => of(perfil)),
    completarMiPerfil: vi.fn((r: string, n: string) => of({ ...perfil, razonSocial: r, nit: n })),
    getMisDocumentos: vi.fn(() => of(documentos)),
    registrarDocumento: vi.fn(() => of({ id: 1, tipo: 'RUT' })),
  };
  const registro = { estadoValidacion: signal(estado) };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [DocumentosProveedorPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ProveedoresApi, useValue: api },
      { provide: ProveedorRegistroService, useValue: registro },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const fixture: ComponentFixture<DocumentosProveedorPage> =
    TestBed.createComponent(DocumentosProveedorPage);
  fixture.detectChanges();
  return { fixture, api, toast };
}

function texto(fixture: ComponentFixture<DocumentosProveedorPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('DocumentosProveedorPage (C2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('no pide los datos de la empresa si ya están completos', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="datos-empresa"]')).toBeNull();
  });

  it('pide razón social y NIT mientras faltan y los guarda', () => {
    const { fixture, api, toast } = setup({ razonSocial: '', nit: '' });
    expect(fixture.nativeElement.querySelector('[data-testid="datos-empresa"]')).toBeTruthy();

    fixture.componentInstance.datosForm.setValue({ razonSocial: ' Frío SAS ', nit: '900-1' });
    fixture.componentInstance.guardarDatos();
    fixture.detectChanges();

    expect(api.completarMiPerfil).toHaveBeenCalledWith('Frío SAS', '900-1');
    expect(toast.success).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="datos-empresa"]')).toBeNull();
  });

  it('no guarda los datos de la empresa con el formulario vacío', () => {
    const { fixture, api } = setup({ razonSocial: '', nit: '' });
    fixture.componentInstance.guardarDatos();
    expect(api.completarMiPerfil).not.toHaveBeenCalled();
  });

  it('explica el estado de validación de la sesión', () => {
    const { fixture } = setup({ estado: 'APROBADO' });
    expect(texto(fixture)).toContain('aprobada');
  });

  it('muestra el estado vacío de documentos', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="documentos-vacio"]')).toBeTruthy();
  });

  it('declara un documento con tipo y vencimiento', () => {
    const { fixture, api, toast } = setup();
    fixture.componentInstance.registrar({ tipo: 'RUT', fechaVencimiento: '2027-12-31' });
    expect(api.registrarDocumento).toHaveBeenCalledWith('RUT', '2027-12-31');
    expect(toast.success).toHaveBeenCalled();
  });

  it('el vencimiento es opcional: el RUT o la certificación bancaria pueden no vencer', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.registrar({ tipo: 'CERTIFICACION_BANCARIA' });
    expect(api.registrarDocumento).toHaveBeenCalledWith('CERTIFICACION_BANCARIA', undefined);
  });

  it('si falla al declarar avisa con el error y no recarga la lista', () => {
    const { fixture, api, toast } = setup();
    api.registrarDocumento.mockReturnValueOnce(throwError(() => new Error('sin red')));

    fixture.componentInstance.registrar({ tipo: 'RUT' });

    expect(toast.error).toHaveBeenCalled();
    expect(api.getMisDocumentos).toHaveBeenCalledTimes(1);
  });

  it('ofrece los tipos de documento de una empresa', () => {
    const { fixture } = setup();
    const tipos = fixture.componentInstance.tiposDocumento;

    expect(tipos.map((t) => t.valor)).toEqual([
      'RUT',
      'CAMARA_COMERCIO',
      'CEDULA_REPRESENTANTE',
      'CERTIFICACION_BANCARIA',
      'OTRO',
    ]);
    expect(tipos.map((t) => t.etiqueta)).toContain('Cámara de Comercio');
    expect(tipos.map((t) => t.etiqueta)).toContain('Cédula del representante legal');
  });

  it('lista los documentos declarados', () => {
    const { fixture } = setup({
      documentos: [{ id: 1, tipo: 'RUT', fechaVencimiento: '2099-12-31' }],
    });
    expect(texto(fixture)).toContain('RUT');
    expect(texto(fixture)).toContain('2099');
  });

  it('marca la vigencia de cada documento igual que en la pantalla del técnico', () => {
    const { fixture } = setup({
      documentos: [
        { id: 1, tipo: 'RUT', fechaVencimiento: '2020-01-01' },
        { id: 2, tipo: 'CAMARA_COMERCIO', fechaVencimiento: '2099-01-01' },
        { id: 3, tipo: 'OTRO' },
      ],
    });
    const q = (id: string) =>
      (fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null)?.textContent ?? '';

    expect(q('vigencia-1')).toContain('Vencido');
    expect(q('vigencia-2')).toContain('Vigente');
    expect(fixture.nativeElement.querySelector('[data-testid="vigencia-3"]')).toBeNull();
    expect(q('documento-2')).toContain('Cámara de Comercio');
  });

  it('avisa arriba cuando hay documentos vencidos', () => {
    const { fixture } = setup({
      documentos: [{ id: 1, tipo: 'RUT', fechaVencimiento: '2020-01-01' }],
    });
    const aviso = fixture.nativeElement.querySelector('[data-testid="aviso-documentos"]') as HTMLElement | null;

    expect(aviso).not.toBeNull();
    expect(aviso!.textContent).toContain('1 vencido');
  });

  it('con los documentos al día no hay aviso', () => {
    const { fixture } = setup({
      documentos: [{ id: 1, tipo: 'RUT', fechaVencimiento: '2099-12-31' }],
    });

    expect(fixture.nativeElement.querySelector('[data-testid="aviso-documentos"]')).toBeNull();
  });

  it('el héroe cuenta los documentos declarados', () => {
    const { fixture } = setup({
      documentos: [
        { id: 1, tipo: 'RUT', fechaVencimiento: '2027-12-31' },
        { id: 2, tipo: 'CEDULA' },
      ],
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="documentos-conteo"]')?.textContent?.trim(),
    ).toContain('2 documentos declarados');
  });

  it('usa la etiqueta canónica del tipo de documento', () => {
    const { fixture } = setup({
      documentos: [{ id: 3, tipo: 'CERTIFICADO', fechaVencimiento: '2027-10-01' }],
    });
    expect(texto(fixture)).toContain('Certificado');

    const page = fixture.componentInstance;
    expect(page.etiquetaDocumento('OTRO')).toBe('Otro');
  });
});
