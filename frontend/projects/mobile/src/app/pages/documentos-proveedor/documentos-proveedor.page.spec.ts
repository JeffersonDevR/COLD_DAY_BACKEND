import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { DocumentoProveedorResponse } from '@core/models/common.models';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileToastService } from '../../core/toast.service';
import { DocumentosProveedorPage } from './documentos-proveedor.page';

type Stub = ReturnType<typeof vi.fn>;

function setup({
  documentos = [] as DocumentoProveedorResponse[],
  estado = 'PENDIENTE' as 'PENDIENTE' | 'APROBADO' | 'RECHAZADO',
} = {}) {
  const api = {
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
    fixture.componentInstance.docForm.setValue({ tipo: 'RUT', fechaVencimiento: '2027-12-31' });
    fixture.componentInstance.registrar();
    expect(api.registrarDocumento).toHaveBeenCalledWith('RUT', '2027-12-31');
    expect(toast.success).toHaveBeenCalled();
  });

  it('no declara con el formulario inválido', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.docForm.setValue({ tipo: 'RUT', fechaVencimiento: '' });
    fixture.componentInstance.registrar();
    expect(api.registrarDocumento).not.toHaveBeenCalled();
  });

  it('lista los documentos declarados', () => {
    const { fixture } = setup({
      documentos: [{ id: 1, tipo: 'RUT', fechaVencimiento: '2027-12-31' }],
    });
    expect(texto(fixture)).toContain('RUT');
    expect(texto(fixture)).toContain('2027-12-31');
  });
});
