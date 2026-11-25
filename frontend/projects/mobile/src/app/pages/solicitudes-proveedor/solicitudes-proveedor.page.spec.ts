import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OfertaInsumoResponse, ProveedorResponse } from '@core/models/common.models';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileGeolocationService } from '../../core/geolocation-native';
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

function perfil(overrides: Partial<ProveedorResponse> = {}): ProveedorResponse {
  return {
    id: 'prov1',
    razonSocial: 'Suministros',
    nit: '900',
    activo: true,
    latitud: 4.6,
    longitud: -74.08,
    ...overrides,
  };
}

function setup({
  ofertas = [oferta()],
  api,
  geo,
}: { ofertas?: OfertaInsumoResponse[]; api?: Record<string, Stub>; geo?: Stub } = {}) {
  const stub = {
    getMiPerfil: vi.fn(() => of(perfil())),
    getMisSolicitudes: vi.fn(() => of(ofertas)),
    aceptar: vi.fn(() => of({ id: 'req1', estado: 'ASIGNADO' })),
    rechazar: vi.fn(() => of(oferta({ estado: 'RECHAZADO' }))),
    despachar: vi.fn(() => of({ id: 'req1', estado: 'DESPACHADO' })),
    entregar: vi.fn(() => of({ id: 'req1', estado: 'ENTREGADO' })),
    fijarMiUbicacion: vi.fn((latitud: number, longitud: number) => of(perfil({ latitud, longitud }))),
    ...api,
  };
  const geolocation = { obtenerPosicion: geo ?? vi.fn(() => of({ latitud: 4.61, longitud: -74.08 })) };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [SolicitudesProveedorPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ProveedoresApi, useValue: stub },
      { provide: MobileGeolocationService, useValue: geolocation },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const fixture: ComponentFixture<SolicitudesProveedorPage> =
    TestBed.createComponent(SolicitudesProveedorPage);
  fixture.detectChanges();
  return { fixture, stub, toast, geolocation };
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
    expect(texto(fixture)).toContain('Acepta con tu tiempo de llegada, despacha y confirma entregas');
  });

  it('acepta la oferta comprometiendo el ETA', () => {
    const { fixture, stub, toast } = setup();
    fixture.componentInstance.aceptar(oferta(), 30);
    expect(stub.aceptar).toHaveBeenCalledWith('of1', 30);
    expect(toast.success).toHaveBeenCalled();
    expect(toast.success.mock.calls[0]?.[1]).toContain('30 min');
  });

  it('abrir la aceptación precarga el ETA sugerido por la distancia', () => {
    const { fixture } = setup({ ofertas: [oferta({ distanciaKm: 7.5, etaSugeridoMinutos: 15 })] });
    fixture.nativeElement.querySelector('[data-testid="aceptar-of1"]').click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('[data-testid="eta-input-of1"]') as HTMLInputElement;
    expect(input.value).toBe('15');
    expect(fixture.nativeElement.querySelector('[data-testid="distancia"]').textContent).toContain('7.5 km');
  });

  it('el ETA se confirma desde el formulario con lo que escribió el proveedor', () => {
    const { fixture, stub } = setup({ ofertas: [oferta({ etaSugeridoMinutos: 15 })] });
    fixture.nativeElement.querySelector('[data-testid="aceptar-of1"]').click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="eta-input-of1"]') as HTMLInputElement;
    input.value = '40';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="eta-confirmar-of1"]').click();

    expect(stub.aceptar).toHaveBeenCalledWith('of1', 40);
  });

  it('un ETA vacío, cero o sobre el tope bloquea la confirmación', () => {
    const { fixture, stub } = setup();
    fixture.componentInstance.abrirAceptar(oferta());
    for (const invalido of ['', '0', '-5', '241', '1.5', 'abc']) {
      fixture.componentInstance.etaTexto.set(invalido);
      expect(fixture.componentInstance.etaValido()).toBe(false);
      fixture.componentInstance.confirmarAceptar(oferta());
    }
    expect(stub.aceptar).not.toHaveBeenCalled();
    fixture.componentInstance.etaTexto.set('240');
    expect(fixture.componentInstance.etaValido()).toBe(true);
  });

  it('un 400 de ETA se explica con el rango permitido', () => {
    const { fixture, toast } = setup({
      api: { aceptar: vi.fn(() => throwError(() => new ApiHttpError('eta', 400))) },
    });
    fixture.componentInstance.aceptar(oferta(), 30);
    expect(toast.error.mock.calls[0]?.[1]).toContain('entre 1 y 240 minutos');
  });

  it('muestra el aviso de ubicación cuando el perfil no la tiene y la fija con la posición del dispositivo', () => {
    const { fixture, stub } = setup({
      api: { getMiPerfil: vi.fn(() => of(perfil({ latitud: undefined, longitud: undefined }))) },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="sin-ubicacion"]')).toBeTruthy();

    fixture.nativeElement.querySelector('[data-testid="fijar-ubicacion"]').click();
    fixture.detectChanges();

    expect(stub.fijarMiUbicacion).toHaveBeenCalledWith(4.61, -74.08);
    expect(fixture.nativeElement.querySelector('[data-testid="sin-ubicacion"]')).toBeNull();
  });

  it('no muestra el aviso de ubicación si el perfil ya la tiene', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="sin-ubicacion"]')).toBeNull();
  });

  it('si no logra la posición avisa con copy humana y no llama a la API', () => {
    const { fixture, stub, toast } = setup({
      api: { getMiPerfil: vi.fn(() => of(perfil({ latitud: undefined, longitud: undefined }))) },
      geo: vi.fn(() => throwError(() => new Error('Permiso de ubicación denegado.'))),
    });
    fixture.componentInstance.fijarUbicacion();
    expect(toast.error).toHaveBeenCalled();
    expect(stub.fijarMiUbicacion).not.toHaveBeenCalled();
  });

  it('despacha el requerimiento asignado', () => {
    const { fixture, stub, toast } = setup({
      ofertas: [oferta({ estado: 'ACEPTADA', requerimiento: { ...oferta().requerimiento!, estado: 'ASIGNADO', etaMinutos: 30 } })],
    });
    expect(fixture.nativeElement.querySelector('[data-testid="eta-comprometido"]').textContent).toContain('30 min');

    fixture.nativeElement.querySelector('[data-testid="despachar-of1"]').click();

    expect(stub.despachar).toHaveBeenCalledWith('req1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('despachar solo aparece en ASIGNADO y confirmar entrega solo en DESPACHADO', () => {
    const asignado = setup({
      ofertas: [oferta({ estado: 'ACEPTADA', requerimiento: { ...oferta().requerimiento!, estado: 'ASIGNADO' } })],
    });
    expect(asignado.fixture.nativeElement.querySelector('[data-testid="despachar-of1"]')).toBeTruthy();
    expect(asignado.fixture.nativeElement.querySelector('[data-testid="entregar-of1"]')).toBeNull();
    TestBed.resetTestingModule();

    const despachado = setup({
      ofertas: [oferta({ estado: 'ACEPTADA', requerimiento: { ...oferta().requerimiento!, estado: 'DESPACHADO' } })],
    });
    expect(despachado.fixture.nativeElement.querySelector('[data-testid="despachar-of1"]')).toBeNull();
    expect(despachado.fixture.nativeElement.querySelector('[data-testid="entregar-of1"]')).toBeTruthy();
  });

  it('un 409 al entregar sin despachar explica que primero se despacha', () => {
    const { fixture, toast } = setup({
      api: { entregar: vi.fn(() => throwError(() => new ApiHttpError('x', 409))) },
    });
    fixture.componentInstance.entregar(
      oferta({ estado: 'ACEPTADA', requerimiento: { ...oferta().requerimiento!, estado: 'DESPACHADO' } }),
    );
    expect(toast.error.mock.calls[0]?.[1]).toContain('Despacha el pedido');
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
    fixture.componentInstance.aceptar(oferta(), 30);
    expect(toast.error).toHaveBeenCalled();
    expect(toast.error.mock.calls[0]?.[1]).toContain('Otra empresa');
    expect(stub.aceptar).toHaveBeenCalled();
  });

  it('el héroe cuenta las solicitudes por gestionar en singular', () => {
    const { fixture } = setup();
    expect(
      fixture.nativeElement.querySelector('[data-testid="solicitudes-conteo"]')?.textContent?.trim(),
    ).toContain('1 solicitud por gestionar');
  });

  it('el conteo excluye las solicitudes ya resueltas', () => {
    const { fixture } = setup({ ofertas: [oferta({ estado: 'RECHAZADO' })] });
    expect(fixture.nativeElement.querySelector('[data-testid="solicitudes-conteo"]')).toBeNull();
  });

  it('el conteo pasa a plural y suma pendientes y aceptadas', () => {
    const { fixture } = setup({
      ofertas: [oferta(), oferta({ id: 'of2', requerimientoId: 'req2', estado: 'ACEPTADA' })],
    });
    expect(texto(fixture)).toContain('2 solicitudes por gestionar');
  });

  it('la cantidad es dato de máquina junto al repuesto', () => {
    const { fixture } = setup();
    const item = fixture.nativeElement.querySelector(
      '[data-testid="solicitud-of1"] .cd-solicitud__item',
    );
    expect(item?.textContent).toContain('2 ×');
    expect(item?.textContent).toContain('Gas R410A 900g');
  });
});
