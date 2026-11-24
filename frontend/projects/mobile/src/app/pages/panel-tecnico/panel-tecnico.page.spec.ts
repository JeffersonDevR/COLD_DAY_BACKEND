import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '@core/models/common.models';
import { SseService, OfertaCreada } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { MobileToastService } from '../../core/toast.service';
import { PanelTecnicoPageMobile } from './panel-tecnico.page';

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
    estado: 'ASIGNADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function oferta(overrides: Partial<OfertaTecnicoResponse> = {}): OfertaTecnicoResponse {
  return {
    id: 'of1',
    otId: 'ot9',
    ot: ot({ id: 'ot9', codigo: 'OT-2026-0099', descripcionFalla: 'Split gotea agua.', prioridad: 'MEDIA' }),
    tecnicoId: 'tec-1',
    distanciaKm: 1.8,
    radioVigenteKm: 5,
    segundosRestantes: 90,
    estado: 'PENDIENTE',
    fechaCreacion: '2026-11-23T10:00:00Z',
    ...overrides,
  };
}

function presenciaStub(overrides: Record<string, unknown> = {}) {
  return {
    modo: signal<'apagada' | 'compartiendo' | 'ejecutando'>('apagada'),
    compartirUbicacion: signal(false),
    switchBloqueado: signal(false),
    reportando: signal(false),
    motivo: signal<string | null>(null),
    sincronizarOts: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    reintentar: vi.fn(),
    ...overrides,
  };
}

function setup({
  tecnicoApi,
  otsApi,
  ofertasApi,
  presencia = presenciaStub(),
}: {
  tecnicoApi?: { getMiPerfil?: Stub };
  otsApi?: { getMisOts?: Stub };
  ofertasApi?: { getOfertasParaTecnico?: Stub };
  presencia?: ReturnType<typeof presenciaStub>;
} = {}) {
  const api = {
    getMiPerfil: tecnicoApi?.getMiPerfil ?? vi.fn(() => of(tecnico())),
    getMisOts: otsApi?.getMisOts ?? vi.fn(() => of([ot()])),
    getOfertasParaTecnico: ofertasApi?.getOfertasParaTecnico ?? vi.fn(() => of([])),
    actualizarEstadoOperativo: vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const sse = { abrirOfertasTecnico: vi.fn(() => new Subject<OfertaCreada>()) };

  TestBed.configureTestingModule({
    imports: [PanelTecnicoPageMobile],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: api },
      { provide: SseService, useValue: sse },
      { provide: TecnicoPresenciaService, useValue: presencia },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<PanelTecnicoPageMobile> =
    TestBed.createComponent(PanelTecnicoPageMobile);
  fixture.detectChanges();

  return { fixture, api, toast, navigate, presencia };
}

function texto(fixture: ComponentFixture<PanelTecnicoPageMobile>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('PanelTecnicoPageMobile (B2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra el técnico y sus órdenes activas', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('Lucas Vega');
    expect(texto(fixture)).toContain('OT-2026-0011');
    expect(texto(fixture)).toContain('Asignada');
  });

  it('destaca la primera orden como próxima y abre la ejecución', () => {
    const { fixture, navigate } = setup();
    const destacada = fixture.nativeElement.querySelector(
      '[data-testid="ot-ot1"]',
    ) as HTMLButtonElement;

    expect(texto(fixture)).toContain('Próxima orden de trabajo');
    expect(texto(fixture)).not.toContain('Toca para abrir la ejecución');
    expect(destacada.className).toContain('cd-ot--proxima');

    destacada.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ejecucion', 'ot1']);
  });

  it('la barra de marca muestra el estado operativo del técnico', () => {
    const { fixture } = setup({
      tecnicoApi: { getMiPerfil: vi.fn(() => of(tecnico({ estadoOperativo: 'OCUPADO' }))) },
    });

    expect(texto(fixture)).toContain('En servicio');
  });

  it('sincroniza la política de presencia con las OTs cargadas', () => {
    const { presencia } = setup();
    expect(presencia.sincronizarOts).toHaveBeenCalled();
  });

  it('muestra error con reintentar y no una lista vacía silenciosa', () => {
    const { fixture } = setup({
      otsApi: { getMisOts: vi.fn(() => throwError(() => new ApiHttpError('boom', 500))) },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="ots-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ots-reintentar"]')).toBeTruthy();
  });

  it('muestra el estado vacío con CTA al radar', () => {
    const { fixture, navigate } = setup({ otsApi: { getMisOts: vi.fn(() => of([])) } });
    const cta = fixture.nativeElement.querySelector('[data-testid="ir-radar"]') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    cta.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/radar']);
  });

  it('habla en tuteo en la cola de órdenes', () => {
    const { fixture } = setup({ otsApi: { getMisOts: vi.fn(() => of([])) } });
    expect(texto(fixture)).toContain('No tienes órdenes en curso');
  });

  it('cada OT es un botón real que abre la ejecución', () => {
    const { fixture, navigate } = setup();
    const ot = fixture.nativeElement.querySelector('[data-testid="ot-ot1"]') as HTMLButtonElement;
    expect(ot.tagName).toBe('BUTTON');
    ot.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ejecucion', 'ot1']);
  });

  it('cambia la disponibilidad contra el API', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.cambiarDisponibilidad('OCUPADO');
    expect(api.actualizarEstadoOperativo).toHaveBeenCalledWith('OCUPADO');
  });

  it('explica el 409 de disponibilidad (OT en curso)', () => {
    const { fixture, api, toast } = setup();
    api.actualizarEstadoOperativo.mockReturnValue(
      throwError(() => new ApiHttpError('activa', 409)),
    );
    fixture.componentInstance.cambiarDisponibilidad('OCUPADO');
    expect(toast.error).toHaveBeenCalled();
    expect(toast.error.mock.calls[0]?.[1]).toContain('orden en curso');
  });

  it('el switch de ubicación llama a la política, no al GPS', () => {
    const { fixture, presencia } = setup();
    fixture.componentInstance.alternarCompartirUbicacion(
      new CustomEvent('ionChange', { detail: { checked: true } }),
    );
    expect(presencia.activar).toHaveBeenCalled();
  });

  it('el título de ubicación afirma el estado (Stitch B0)', () => {
    const apagada = setup();
    expect(texto(apagada.fixture)).toContain('Compartir ubicación');
    TestBed.resetTestingModule();

    const activa = setup({
      presencia: presenciaStub({ modo: signal('compartiendo'), compartirUbicacion: signal(true) }),
    });
    expect(texto(activa.fixture)).toContain('Compartiendo ubicación');
    expect(texto(activa.fixture)).toContain('Visible para clientes cercanos.');
  });

  it('muestra las ofertas activas con conteo real y abre el radar', () => {
    const { fixture, navigate } = setup({
      ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([oferta()])) },
    });

    expect(texto(fixture)).toContain('Ofertas activas (1)');
    expect(texto(fixture)).toContain('Split gotea agua.');
    expect(texto(fixture)).toContain('Expira en 1m 30s');
    expect(texto(fixture)).toContain('A 1,8 km');

    const tarjeta = fixture.nativeElement.querySelector(
      '[data-testid="oferta-panel-ot9"]',
    ) as HTMLButtonElement;
    expect(tarjeta.tagName).toBe('BUTTON');
    tarjeta.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/radar']);
  });

  it('sin ofertas no hay sección ni conteo en cero', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="ofertas-activas"]')).toBeNull();
    expect(texto(fixture)).not.toContain('Ofertas activas');
  });

  it('el aviso de prioridad alta solo aparece con una oferta ALTA real', () => {
    const media = setup({
      ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([oferta()])) },
    });
    expect(media.fixture.nativeElement.querySelector('[data-testid="ofertas-prioridad"]')).toBeNull();
    TestBed.resetTestingModule();

    const alta = setup({
      ofertasApi: {
        getOfertasParaTecnico: vi.fn(() =>
          of([oferta({ ot: ot({ id: 'ot9', prioridad: 'ALTA' }) })]),
        ),
      },
    });
    expect(texto(alta.fixture)).toContain('Prioridad alta');
  });

  it('el countdown hace tictac y retira la oferta al expirar', () => {
    vi.useFakeTimers();
    try {
      const getOfertas = vi
        .fn()
        .mockReturnValueOnce(of([oferta({ segundosRestantes: 2 })]))
        .mockReturnValue(of([]));
      const { fixture } = setup({ ofertasApi: { getOfertasParaTecnico: getOfertas } });
      expect(texto(fixture)).toContain('Expira en 2s');

      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(texto(fixture)).toContain('Expira en 1s');

      const llamadasAntes = getOfertas.mock.calls.length;
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      // Expiró: se retira de la vista y se recarga la lista real del backend.
      expect(fixture.nativeElement.querySelector('[data-testid="oferta-panel-ot9"]')).toBeNull();
      expect(getOfertas.mock.calls.length).toBeGreaterThan(llamadasAntes);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no duplica la ruta al radar: con ofertas visibles el vacío no lleva CTA', () => {
    const { fixture } = setup({
      otsApi: { getMisOts: vi.fn(() => of([])) },
      ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([oferta()])) },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="ots-vacio"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ir-radar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="oferta-panel-ot9"]')).toBeTruthy();
  });

  it('la distancia en 0 no se pinta como métrica: solo el radio difundido', () => {
    const { fixture } = setup({
      ofertasApi: { getOfertasParaTecnico: vi.fn(() => of([oferta({ distanciaKm: 0 })])) },
    });
    expect(texto(fixture)).toContain('Dentro de tu radio');
    expect(texto(fixture)).not.toContain('A 0 km');
  });

  it('no repite que la cuenta está habilitada', () => {
    const { fixture } = setup();

    expect(texto(fixture)).not.toContain('para recibir órdenes');
  });

  it('con la cuenta pendiente habla solo la alerta, no el subtítulo', () => {
    const { fixture } = setup({
      tecnicoApi: { getMiPerfil: vi.fn(() => of(tecnico({ estadoValidacion: 'PENDIENTE' }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="validacion-pendiente"]')).toBeTruthy();
    expect(texto(fixture)).not.toContain('para recibir órdenes');
  });

  it('la visibilidad en el radar no es un chip aparte', () => {
    const { fixture } = setup({
      presencia: presenciaStub({
        modo: signal('compartiendo'),
        compartirUbicacion: signal(true),
        reportando: signal(true),
      }),
    });

    expect(fixture.nativeElement.querySelector('[data-testid="radar-visible"]')).toBeNull();
    expect(texto(fixture)).not.toContain('Visible en el radar');
  });

  it('no muestra la nota fija de bloqueo con una OT en curso', () => {
    const { fixture } = setup();

    expect(texto(fixture)).not.toContain('Bloqueada con una OT en curso');
  });

  it('sin técnico cargado no pinta undefined ni subtítulo', () => {
    const { fixture } = setup({
      tecnicoApi: { getMiPerfil: vi.fn(() => of(undefined)) },
    });

    expect(texto(fixture)).toContain('Tu panel de técnico');
    expect(texto(fixture)).not.toContain('undefined');
    expect(texto(fixture)).not.toContain('para recibir órdenes');
  });
});
