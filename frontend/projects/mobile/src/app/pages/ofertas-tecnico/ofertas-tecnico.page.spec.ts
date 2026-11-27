import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { signal } from '@angular/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '@core/models/common.models';
import { SseService, OfertaCreada } from '@core/service/sse.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { MobileGeolocationService } from '../../core/geolocation-native';
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
  ubicacionApagada = false,
  posicion = of({ latitud: 7.89, longitud: -72.5 }),
}: {
  ubicacionApagada?: boolean;
  posicion?: Observable<{ latitud: number; longitud: number }>;
  tecnicoApi?: { getMiPerfil?: Stub };
  ofertasApi?: { getOfertasParaTecnico?: Stub; aceptarOferta?: Stub };
} = {}) {
  const api = {
    getMiPerfil: tecnicoApi?.getMiPerfil ?? vi.fn(() => of(tecnico())),
    getOfertasParaTecnico: ofertasApi?.getOfertasParaTecnico ?? vi.fn(() => of([oferta()])),
    aceptarOferta: ofertasApi?.aceptarOferta ?? vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const presencia = {
    modo: signal(ubicacionApagada ? 'apagada' : 'compartiendo'),
    motivo: signal<string | null>(null),
    activar: vi.fn(),
    reintentar: vi.fn(),
  };
  const geolocation = { obtenerPosicion: vi.fn(() => posicion) };
  const sse = { abrirOfertasTecnico: vi.fn(() => new Subject<OfertaCreada>()) };

  TestBed.configureTestingModule({
    imports: [OfertasTecnicoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: api },
      { provide: SseService, useValue: sse },
      { provide: TecnicoPresenciaService, useValue: presencia },
      { provide: MobileGeolocationService, useValue: geolocation },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<OfertasTecnicoPage> =
    TestBed.createComponent(OfertasTecnicoPage);
  fixture.detectChanges();

  return { fixture, api, toast, navigate, presencia, geolocation };
}

function texto(fixture: ComponentFixture<OfertasTecnicoPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('OfertasTecnicoPage (B1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('avisa que sin ubicación no hay ofertas cercanas y la activa tras pedir el permiso', () => {
    const { fixture, presencia, geolocation } = setup({ ubicacionApagada: true });
    const boton = fixture.nativeElement.querySelector(
      '[data-testid="radar-activar-ubicacion"]',
    ) as HTMLElement;
    expect(boton).toBeTruthy();

    fixture.componentInstance.activarUbicacion();

    expect(geolocation.obtenerPosicion).toHaveBeenCalled();
    expect(presencia.activar).toHaveBeenCalled();
  });

  it('no activa el reporte si el permiso de ubicación se niega', () => {
    const { fixture, presencia, toast } = setup({
      ubicacionApagada: true,
      posicion: throwError(() => new Error('Permiso de ubicación denegado.')),
    });

    fixture.componentInstance.activarUbicacion();

    expect(presencia.activar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('no muestra el aviso de ubicación cuando ya se está compartiendo', () => {
    const { fixture } = setup();
    expect(
      fixture.nativeElement.querySelector('[data-testid="radar-ubicacion-apagada"]'),
    ).toBeNull();
  });

  it('muestra la oferta con distancia y vencimiento', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('OT-2026-0011');
    expect(texto(fixture)).toContain('3,2 km');
    expect(texto(fixture)).toContain('Expira en 42s');
    expect(texto(fixture)).toContain('Aceptar servicio');
  });

  it('no inventa distancia cuando el backend todavía no la expone', () => {
    const { fixture } = setup({
      ofertasApi: {
        getOfertasParaTecnico: vi.fn(() => of([oferta({ distanciaKm: 0 })])),
      },
    });
    expect(texto(fixture)).toContain('Dentro de tu radio');
    expect(texto(fixture)).not.toContain('A 0 km');
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
    const { fixture, toast } = setup({
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

  it('el estado vacío ofrece volver al panel', () => {
    const { fixture, navigate } = setup({
      ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([])) },
    });
    const cta = fixture.nativeElement.querySelector('[data-testid="radar-ir-panel"]') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    cta.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ots']);
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

  it('el héroe cuenta las ofertas activas en singular', () => {
    const { fixture } = setup();
    expect(
      fixture.nativeElement.querySelector('[data-testid="radar-conteo"]')?.textContent?.trim(),
    ).toContain('1 oferta cerca de ti');
  });

  it('el conteo pasa a plural con varias ofertas', () => {
    const { fixture } = setup({
      ofertasApi: {
        getOfertasParaTecnico: vi.fn(() =>
          of([oferta(), oferta({ id: 'of2', otId: 'ot2', ot: ot({ id: 'ot2' }) })]),
        ),
      },
    });
    expect(texto(fixture)).toContain('2 ofertas cerca de ti');
  });

  it('la falla encabeza la tarjeta y la categoría usa su etiqueta canónica', () => {
    const { fixture } = setup();
    const tarjeta = fixture.nativeElement.querySelector('[data-testid="oferta-ot1"]');
    expect(tarjeta?.querySelector('.cd-oferta__titulo')?.textContent).toContain('No enfría.');
    expect(tarjeta?.querySelector('.cd-oferta__icono')?.getAttribute('aria-hidden')).toBe('true');
    expect(texto(fixture)).toContain('Aire acondicionado');
  });

  it('cada categoría mapea a su icono registrado', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance;
    expect(page.iconoCategoria('AIRE_ACONDICIONADO')).toBe('thermometer-outline');
    expect(page.iconoCategoria('REFRIGERACION')).toBe('snow-outline');
    expect(page.iconoCategoria('LAVADORAS')).toBe('water-outline');
    expect(page.iconoCategoria('ELECTRICIDAD')).toBe('flash-outline');
    expect(page.iconoCategoria('CAMARAS_VIGILANCIA')).toBe('videocam-outline');
  });
});

describe('Radar: deslizar para recargar', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('tiene el indicador en la pantalla', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('ion-refresher[slot="fixed"]')).not.toBeNull();
  });

  it('trae los datos nuevos', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.api.getOfertasParaTecnico.mockReturnValue(of([]));
    fixture.componentInstance.recargar().subscribe();
    fixture.detectChanges();
    expect(fixture.componentInstance.ofertas()).toHaveLength(0);
  });

  it('si falla, entrega el error y conserva lo que se ve', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.api.getOfertasParaTecnico.mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));
    const error = vi.fn();
    fixture.componentInstance.recargar().subscribe({ error });
    fixture.detectChanges();
    expect(error).toHaveBeenCalled();
    expect(fixture.componentInstance.ofertas()).toHaveLength(1);
  });
});
