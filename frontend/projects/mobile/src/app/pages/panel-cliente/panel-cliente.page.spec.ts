import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular, SegmentCustomEvent } from '@ionic/angular';
import { provideRouter, Router } from '@angular/router';
import { WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import { ClientesApi } from '@core/service/clientes-api';
import { OtResponse } from '@core/models/common.models';
import { POLL_INTERVAL_MS } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';
import { PanelClientePage } from './panel-cliente.page';

/** Vista del componente con lo que ejercitan los tests (miembros protected). */
interface PanelInternals {
  readonly cargando: WritableSignal<boolean>;
  readonly errorCarga: WritableSignal<string | null>;
  readonly sinPerfilCliente: WritableSignal<boolean>;
  readonly filtro: WritableSignal<string>;
  readonly activas: () => number;
  readonly finalizadas: () => number;
  readonly serviciosFiltrados: () => OtResponse[];
  cambiarFiltro(evento: SegmentCustomEvent): void;
  reintentar(): void;
  pedirTecnico(): void;
  verEquipos(): void;
}

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0001',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    direccion: 'Calle 15 # 3E-28',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function otsDeEjemplo(): OtResponse[] {
  return [
    ot({ id: 'en-camino', estado: 'EN_CAMINO', tecnicoId: 'tec-1' }),
    ot({ id: 'finalizada', estado: 'FINALIZADA', tecnicoId: 'tec-1' }),
    ot({ id: 'cancelada', estado: 'CANCELADA' }),
    ot({ id: 'solicitada', estado: 'SOLICITADA' }),
  ];
}

function setup(getOts: ReturnType<typeof vi.fn>) {
  const clienteApi = { getOtsPorCliente: getOts };
  const toast = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: ClientesApi, useValue: clienteApi },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3, nombre: 'María' }) } },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture: ComponentFixture<PanelClientePage> = TestBed.createComponent(PanelClientePage);
  fixture.detectChanges();
  const page = fixture.componentInstance as unknown as PanelInternals;
  return { fixture, page, clienteApi, toast, navigate };
}

function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

function idsVisibles(page: PanelInternals): string[] {
  return page.serviciosFiltrados().map((item) => item.id);
}

function filtro(valor: string): SegmentCustomEvent {
  return { detail: { value: valor } } as SegmentCustomEvent;
}

function texto(fixture: ComponentFixture<PanelClientePage>): string {
  return fixture.nativeElement.textContent as string;
}

describe('PanelClientePage móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga el listado inicial y pinta una tarjeta por OT', () => {
    const { fixture, page, clienteApi } = setup(vi.fn(() => of(otsDeEjemplo())));

    expect(clienteApi.getOtsPorCliente).toHaveBeenCalledWith('3');
    expect(page.cargando()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="panel-ot"]')).toHaveLength(2);
  });

  it('saluda con el nombre de la sesión', () => {
    const { fixture } = setup(vi.fn(() => of([])));

    expect(texto(fixture)).toContain('Hola, María');
  });

  it('muestra el código legible de la OT, nunca el id interno', () => {
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const { fixture } = setup(vi.fn(() => of([ot({ id: idInterno, codigo: 'OT-2026-0013' })])));

    expect(texto(fixture)).toContain('OT-2026-0013');
    expect(texto(fixture)).not.toContain(idInterno);
  });

  it('sin código del backend muestra "Sin código"', () => {
    const { fixture } = setup(vi.fn(() => of([ot({ codigo: undefined })])));

    expect(texto(fixture)).toContain('Sin código');
  });

  it('los contadores resumen toda la lista y no dependen del filtro', () => {
    const { page } = setup(vi.fn(() => of(otsDeEjemplo())));

    expect(page.activas()).toBe(2);
    expect(page.finalizadas()).toBe(1);

    for (const valor of ['TODAS', 'ACTIVAS', 'COMPLETADAS', 'SIN_TECNICO']) {
      page.cambiarFiltro(filtro(valor));
      expect(page.activas()).toBe(2);
      expect(page.finalizadas()).toBe(1);
    }
  });

  it('TODAS incluye las canceladas y SIN_TECNICO solo las que esperan técnico', () => {
    const { page } = setup(vi.fn(() => of(otsDeEjemplo())));

    page.cambiarFiltro(filtro('TODAS'));
    expect(idsVisibles(page)).toEqual(['en-camino', 'finalizada', 'cancelada', 'solicitada']);

    page.cambiarFiltro(filtro('SIN_TECNICO'));
    expect(idsVisibles(page)).toEqual(['solicitada']);
  });

  it('el control segmentado ofrece las cuatro vistas', () => {
    const { fixture } = setup(vi.fn(() => of(otsDeEjemplo())));
    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('ion-segment-button'),
    ) as HTMLElement[];

    expect(botones.map((boton) => boton.textContent?.trim())).toEqual([
      'Todas',
      'Activas',
      'Completadas',
      'Sin técnico',
    ]);
  });

  it('el estado vacío explica qué falta según la vista y ofrece pedir un técnico', () => {
    const { fixture, page } = setup(vi.fn(() => of([ot({ tecnicoId: 'tec-1' })])));

    page.cambiarFiltro(filtro('COMPLETADAS'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-vacio"]')).not.toBeNull();
    expect(texto(fixture)).toContain('Todavía no tenés servicios completados');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-vacio-cta"]')).not.toBeNull();
  });

  it('la lista vacía del filtro inicial no es un error de carga', () => {
    const { fixture, page } = setup(vi.fn(() => of([])));

    expect(page.errorCarga()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-error"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-vacio"]')).not.toBeNull();
  });

  it('cada OT ofrece el acceso al seguimiento (A6)', () => {
    const { fixture, navigate } = setup(vi.fn(() => of(otsDeEjemplo())));

    const enlaces = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="panel-ot-ver"]'),
    ) as HTMLElement[];
    expect(enlaces).toHaveLength(2);

    enlaces[0].click();

    expect(navigate).toHaveBeenCalledWith('/cliente/ot/en-camino');
  });

  it('un fallo de carga inicial muestra el error con Reintentar y no una lista vacía', () => {
    const getOts = vi.fn(() => throwError(() => new ApiHttpError('boom', 500)));
    const { fixture, page } = setup(getOts);

    expect(page.cargando()).toBe(false);
    expect(page.errorCarga()).toContain('error en el servidor');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-error"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-vacio"]')).toBeNull();
  });

  it('Reintentar vuelve a pedir el listado y pinta las OTs', () => {
    const getOts = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValue(of([ot({ estado: 'EN_CAMINO' })]));
    const { fixture, page } = setup(getOts);

    const boton = fixture.nativeElement.querySelector(
      '[data-testid="panel-reintentar"]',
    ) as HTMLElement;
    boton.click();
    fixture.detectChanges();

    expect(getOts).toHaveBeenCalledTimes(2);
    expect(page.errorCarga()).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="panel-ot"]')).toHaveLength(1);
  });

  it('sin perfil de cliente muestra la tarjeta honesta con CTA a la solicitud', () => {
    const { fixture, page, navigate } = setup(
      vi.fn(() =>
        throwError(
          () => new ApiHttpError('No existe un perfil de cliente para el usuario: 3', 404),
        ),
      ),
    );

    expect(page.sinPerfilCliente()).toBe(true);
    expect(page.errorCarga()).toBeNull();
    expect(texto(fixture)).toContain('Todavía no tenés perfil de cliente');
    // El 404 de perfil no es un error de carga ni un listado vacío genérico.
    expect(fixture.nativeElement.querySelector('[data-testid="panel-error"]')).toBeNull();

    const cta = fixture.nativeElement.querySelector(
      '[data-testid="panel-crear-perfil"]',
    ) as HTMLElement;
    cta.click();

    expect(navigate).toHaveBeenCalledWith('/cliente/solicitar');
  });

  it('el CTA del panel lleva a la solicitud y el atajo Historial a la tab de equipos', () => {
    const { fixture, navigate } = setup(vi.fn(() => of([])));

    (fixture.nativeElement.querySelector('[data-testid="panel-solicitar"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/solicitar');

    // La web apunta a `/cliente/historial`, una ruta inexistente: acá va a la tab real.
    (fixture.nativeElement.querySelector('[data-testid="panel-equipos"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/equipos');
    expect(navigate).not.toHaveBeenCalledWith('/cliente/historial');
  });

  describe('refresco periódico', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('refresca una vez por intervalo con la app visible', () => {
      cambiarPestana('visible');
      const getOts = vi.fn(() => of([ot({ id: 'a' })]));
      const { page } = setup(getOts);

      expect(getOts).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(getOts).toHaveBeenCalledTimes(2);
      expect(page.serviciosFiltrados().map((item) => item.id)).toEqual(['a']);
    });

    it('no consulta mientras la app está en segundo plano', () => {
      cambiarPestana('hidden');
      const getOts = vi.fn(() => of([ot({ id: 'a' })]));
      setup(getOts);

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getOts).toHaveBeenCalledTimes(1);
    });

    it('un refresco fallido conserva la lista que el cliente ya está viendo', () => {
      cambiarPestana('visible');
      const getOts = vi
        .fn()
        .mockReturnValueOnce(of([ot({ id: 'a', estado: 'EN_CAMINO' })]))
        .mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));
      const { page, toast } = setup(getOts);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(getOts).toHaveBeenCalledTimes(2);
      expect(page.serviciosFiltrados().map((item) => item.id)).toEqual(['a']);
      expect(page.errorCarga()).toBeNull();
      // El refresco automático no avisa: no hay acción del usuario que explicar.
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('deja de refrescar al destruirse la pantalla', () => {
      cambiarPestana('visible');
      const getOts = vi.fn(() => of([ot({ id: 'a' })]));
      const { fixture } = setup(getOts);

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getOts).toHaveBeenCalledTimes(1);
    });
  });
});
