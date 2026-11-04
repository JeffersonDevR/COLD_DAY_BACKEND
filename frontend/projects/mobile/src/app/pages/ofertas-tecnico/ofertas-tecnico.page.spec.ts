import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '@core/models/common.models';
import { SseService, OfertaCreada } from '@core/service/sse.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { MobileToastService } from '../../core/toast.service';
import { OfertasTecnicoPage } from './ofertas-tecnico.page';

type Stub = ReturnType<typeof vi.fn>;

function tecnico(overrides: Partial<TecnicoResponse> = {}): TecnicoResponse {
  return {
    id: 'tec-1',
    nombre: 'Lucas Vega',
    correo: 'lucas@coldday.com',
    estadoValidacion: 'APROBADO',
    estadoOperativo: 'DISPONIBLE',
    ...overrides,
  };
}

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0011',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'BUSCANDO_TECNICO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function oferta(overrides: Partial<OfertaTecnicoResponse> = {}): OfertaTecnicoResponse {
  return {
    id: 'of1',
    otId: 'ot1',
    ot: ot(),
    tecnicoId: 'tec-1',
    distanciaKm: 3.2,
    radioVigenteKm: 5,
    segundosRestantes: 42,
    estado: 'PENDIENTE',
    fechaCreacion: '2026-11-04T10:00:00Z',
    ...overrides,
  };
}

function setup({
  tecnicoApi,
  ofertasApi,
}: {
  tecnicoApi?: { getMiPerfil?: Stub };
  ofertasApi?: { getOfertasParaTecnico?: Stub; aceptarOferta?: Stub };
} = {}) {
  const api = {
    getMiPerfil: tecnicoApi?.getMiPerfil ?? vi.fn(() => of(tecnico())),
    getOfertasParaTecnico: ofertasApi?.getOfertasParaTecnico ?? vi.fn(() => of([oferta()])),
    aceptarOferta: ofertasApi?.aceptarOferta ?? vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const sse = { abrirOfertasTecnico: vi.fn(() => new Subject<OfertaCreada>()) };

  TestBed.configureTestingModule({
    imports: [OfertasTecnicoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: api },
      { provide: SseService, useValue: sse },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<OfertasTecnicoPage> =
    TestBed.createComponent(OfertasTecnicoPage);
  fixture.detectChanges();

  return { fixture, api, toast, navigate };
}

function texto(fixture: ComponentFixture<OfertasTecnicoPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('OfertasTecnicoPage (B1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra la oferta con distancia y vencimiento', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('OT-2026-0011');
    expect(texto(fixture)).toContain('3,2 km');
    expect(texto(fixture)).toContain('Expira en 42s');
  });

  it('acepta con 0 auxiliares por defecto y navega al panel', () => {
    const { fixture, api, navigate } = setup();
    fixture.componentInstance.aceptar(oferta());
    expect(api.aceptarOferta).toHaveBeenCalledWith('of1', 'tec-1', 0);
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ejecucion', 'ot1']);
  });

  it('envía los auxiliares declarados', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.setAuxiliares('ot1', 2);
    fixture.componentInstance.aceptar(oferta());
    expect(api.aceptarOferta).toHaveBeenCalledWith('of1', 'tec-1', 2);
  });

  it('un 409 explica la concurrencia sin inventar otras causas', () => {
    const { fixture, api, toast } = setup({
      ofertasApi: { aceptarOferta: vi.fn(() => throwError(() => new ApiHttpError('tomada', 409))) },
    });
    fixture.componentInstance.aceptar(oferta());
    expect(toast.error).toHaveBeenCalled();
    expect(toast.error.mock.calls[0]?.[1]).toContain('otro técnico');
  });

  it('bloquea aceptar cuando la validación no está aprobada', () => {
    const { fixture, api } = setup({
      tecnicoApi: { getMiPerfil: vi.fn(() => of(tecnico({ estadoValidacion: 'PENDIENTE' }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="radar-no-habilitado"]')).toBeTruthy();
    const boton = fixture.nativeElement.querySelector(
      '[data-testid="aceptar-ot1"]',
    ) as HTMLButtonElement | null;
    expect(boton === null || boton.disabled).toBe(true);
    expect(api.aceptarOferta).not.toHaveBeenCalled();
  });

  it('muestra el estado vacío cuando no hay ofertas', () => {
    const { fixture } = setup({ ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([])) } });
    expect(fixture.nativeElement.querySelector('[data-testid="radar-vacio"]')).toBeTruthy();
  });

  it('muestra error con reintentar', () => {
    const { fixture } = setup({
      ofertasApi: {
        getOfertasParaTecnico: vi.fn(() => throwError(() => new ApiHttpError('boom', 500))),
      },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="radar-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="radar-reintentar"]')).toBeTruthy();
  });
});
