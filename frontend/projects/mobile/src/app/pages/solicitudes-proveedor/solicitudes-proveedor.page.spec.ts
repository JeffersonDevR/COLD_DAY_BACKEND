import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OfertaInsumoResponse } from '@core/models/common.models';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileToastService } from '../../core/toast.service';
import { SolicitudesProveedorPage } from './solicitudes-proveedor.page';

type Stub = ReturnType<typeof vi.fn>;

function oferta(overrides: Partial<OfertaInsumoResponse> = {}): OfertaInsumoResponse {
  return {
    id: 'of1',
    requerimientoId: 'req1',
    proveedorId: 'prov1',
    estado: 'PENDIENTE',
    requerimiento: {
      id: 'req1',
      otId: 'ot1',
      tecnicoId: 'tec1',
      estado: 'SOLICITADO',
      items: [{ descripcion: 'Gas R410A 900g', cantidad: 2 }],
    },
    ...overrides,
  };
}

function setup({ ofertas = [oferta()], api }: { ofertas?: OfertaInsumoResponse[]; api?: Record<string, Stub> } = {}) {
  const stub = {
    getMisSolicitudes: vi.fn(() => of(ofertas)),
    aceptar: vi.fn(() => of({ id: 'req1', estado: 'ASIGNADO' })),
    rechazar: vi.fn(() => of(oferta({ estado: 'RECHAZADO' }))),
    entregar: vi.fn(() => of({ id: 'req1', estado: 'ENTREGADO' })),
    ...api,
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [SolicitudesProveedorPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ProveedoresApi, useValue: stub },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const fixture: ComponentFixture<SolicitudesProveedorPage> =
    TestBed.createComponent(SolicitudesProveedorPage);
  fixture.detectChanges();
  return { fixture, stub, toast };
}

function texto(fixture: ComponentFixture<SolicitudesProveedorPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('SolicitudesProveedorPage (C1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lista la solicitud con sus ítems y estado', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('Gas R410A 900g');
    expect(texto(fixture)).toContain('Pendiente');
  });

  it('acepta la oferta', () => {
    const { fixture, stub, toast } = setup();
    fixture.componentInstance.aceptar(oferta());
    expect(stub.aceptar).toHaveBeenCalledWith('of1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('rechaza la oferta', () => {
    const { fixture, stub } = setup();
    fixture.componentInstance.rechazar(oferta());
    expect(stub.rechazar).toHaveBeenCalledWith('of1');
  });

  it('confirma entrega con el requerimiento asignado', () => {
    const { fixture, stub } = setup({ ofertas: [oferta({ estado: 'ACEPTADA' })] });
    fixture.componentInstance.entregar(oferta({ estado: 'ACEPTADA' }));
    expect(stub.entregar).toHaveBeenCalledWith('req1');
  });

  it('explica un 403 como bloqueo de validación, no como error de red', () => {
    const { fixture } = setup({
      api: {
        getMisSolicitudes: vi.fn(() => throwError(() => new ApiHttpError('bloqueado', 403))),
      },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="validacion-bloquea"]')).toBeTruthy();
  });

  it('muestra el estado vacío', () => {
    const { fixture } = setup({ ofertas: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="solicitudes-vacio"]')).toBeTruthy();
  });

  it('explica un 409 de aceptación como concurrencia', () => {
    const { fixture, stub, toast } = setup({
      api: { aceptar: vi.fn(() => throwError(() => new ApiHttpError('tomada', 409))) },
    });
    fixture.componentInstance.aceptar(oferta());
    expect(toast.error).toHaveBeenCalled();
    expect(toast.error.mock.calls[0]?.[1]).toContain('Otra empresa');
    expect(stub.aceptar).toHaveBeenCalled();
  });
});
