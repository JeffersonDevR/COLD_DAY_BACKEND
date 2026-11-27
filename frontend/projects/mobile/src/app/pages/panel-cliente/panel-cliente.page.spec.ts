import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
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
  readonly activa: () => OtResponse | null;
  readonly otras: () => OtResponse[];
  readonly historial: () => OtResponse[];
  reintentar(): void;
  pedirTecnico(): void;
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
  return [page.activa(), ...page.otras(), ...page.historial()].flatMap((item) =>
    item ? [item.id] : [],
  );
}

function todos(fixture: ComponentFixture<PanelClientePage>, id: string): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`));
}

function nodo(fixture: ComponentFixture<PanelClientePage>, id: string): HTMLElement | null {
  return todos(fixture, id)[0] ?? null;
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
    expect(todos(fixture, 'orden-activa')).toHaveLength(1);
    expect(todos(fixture, 'panel-ot')).toHaveLength(1);
    expect(todos(fixture, 'panel-historial-ot')).toHaveLength(2);
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

  it('sin código: la tarjeta grande lo omite y la compacta dice "Sin código"', () => {
    const activa = setup(vi.fn(() => of([ot({ codigo: undefined })])));
    expect(texto(activa.fixture)).not.toContain('Sin código');
    expect(texto(activa.fixture)).not.toContain('undefined');

    TestBed.resetTestingModule();
    const cerrada = setup(vi.fn(() => of([ot({ codigo: undefined, estado: 'FINALIZADA' })])));
    expect(texto(cerrada.fixture)).toContain('Sin código');
  });

  it('cada tarjeta muestra el chip de prioridad real, con Media por defecto', () => {
    const { fixture } = setup(
      vi.fn(() =>
        of([
          ot({ id: 'alta', estado: 'EN_CAMINO', tecnicoId: 't', prioridad: 'ALTA' }),
          ot({ id: 'sin-dato', estado: 'EN_CAMINO', tecnicoId: 't' }),
        ]),
      ),
    );

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="prioridad-chip"]'),
    ) as HTMLElement[];
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Alta', 'Media']);
    expect(chips[0].classList).toContain('cd-chip--cerrada');
    expect(chips[1].classList).toContain('cd-chip--curso');
  });

  const cambiante = (id: string, datos: Partial<OtResponse>) =>
    ot({ id, codigo: `OT-${id}`, tecnicoId: 't', ...datos });
  const boton = (fixture: ComponentFixture<PanelClientePage>) =>
    nodo(fixture, 'orden-activa-accion') as HTMLElement;
  const enCamino = cambiante('camino', { estado: 'EN_CAMINO' });
  const conPresupuesto = cambiante('presupuesto', {
    estado: 'EN_DIAGNOSTICO',
    diagnostico: {} as never,
  });
  const sinPagar = cambiante('pago', { estado: 'ASIGNADA', visitaPagada: false });

  it('la que pide pagar va grande', () => {
    const { fixture, navigate } = setup(vi.fn(() => of([enCamino, conPresupuesto, sinPagar])));

    expect(boton(fixture).textContent?.trim()).toBe('Pagar la visita');
    boton(fixture).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/pago');
  });

  it('después, la del presupuesto', () => {
    const { fixture, navigate } = setup(vi.fn(() => of([enCamino, conPresupuesto])));

    expect(boton(fixture).textContent?.trim()).toBe('Revisar presupuesto');
    boton(fixture).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/presupuesto/diagnostico');
  });

  it('sin acciones, la más reciente; sin fecha al final', () => {
    const { page } = setup(
      vi.fn(() =>
        of([
          cambiante('sin-fecha', { estado: 'EN_CAMINO' }),
          cambiante('vieja', { estado: 'EN_CAMINO', fechaCreacion: '2026-11-01T10:00:00Z' }),
          cambiante('nueva', { estado: 'EN_CAMINO', fechaCreacion: '2026-11-20T10:00:00Z' }),
        ]),
      ),
    );

    expect(page.activa()?.id).toBe('nueva');
    expect(page.otras().map((item) => item.id)).toEqual(['vieja', 'sin-fecha']);
  });

  it('disputa no invita a pagar', () => {
    const { fixture, navigate } = setup(
      vi.fn(() => of([cambiante('disputa', { estado: 'DISPUTADA' })])),
    );

    expect(boton(fixture).textContent?.trim()).toBe('Ver seguimiento');
    boton(fixture).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/disputa');
  });

  it('la tarjeta dice el estado, el técnico y la dirección', () => {
    const { fixture } = setup(
      vi.fn(() =>
        of([
          ot({
            estado: 'EN_CAMINO',
            tecnicoId: 't',
            tecnicoNombre: 'Lucas Vega',
            llegadaEn: '2026-11-27T10:00:00Z',
            direccion: undefined,
            barrio: 'Caobos',
          }),
        ]),
      ),
    );
    const tarjeta = nodo(fixture, 'orden-activa')?.textContent ?? '';

    expect(tarjeta).toContain('El técnico llegó');
    expect(tarjeta).toContain('Lucas Vega');
    expect(tarjeta).toContain('Caobos');
  });

  it('reparte otras e historial', () => {
    const { fixture, page } = setup(vi.fn(() => of(otsDeEjemplo())));

    expect(idsVisibles(page)).toEqual(['en-camino', 'solicitada', 'finalizada', 'cancelada']);
    expect(todos(fixture, 'orden-activa')).toHaveLength(1);
    expect(todos(fixture, 'panel-ot')).toHaveLength(1);
    expect(todos(fixture, 'panel-historial-ot')).toHaveLength(2);
  });

  it('el historial empieza plegado y se abre al tocarlo', () => {
    const { fixture } = setup(vi.fn(() => of(otsDeEjemplo())));
    const cabecera = nodo(fixture, 'panel-historial') as HTMLElement;
    const contenido = nodo(fixture, 'panel-historial-contenido') as HTMLElement;

    expect(cabecera.textContent).toContain('Historial (2)');
    expect(cabecera.getAttribute('aria-expanded')).toBe('false');
    expect(contenido.hidden).toBe(true);

    cabecera.click();
    fixture.detectChanges();
    expect(cabecera.getAttribute('aria-expanded')).toBe('true');
    expect(contenido.hidden).toBe(false);
  });

  it('con orden activa el pie va sin relleno', () => {
    const { fixture } = setup(vi.fn(() => of([enCamino])));

    expect((nodo(fixture, 'panel-solicitar') as HTMLElement & { fill?: string }).fill).toBe(
      'outline',
    );
  });

  it('sin orden activa el pie va relleno y lleva a la solicitud', () => {
    const { fixture, navigate } = setup(vi.fn(() => of([])));
    const pie = nodo(fixture, 'panel-solicitar') as HTMLElement & { fill?: string };

    expect(pie.fill).toBe('solid');
    pie.click();
    expect(navigate).toHaveBeenCalledWith('/cliente/solicitar');
  });

  it('sin ninguna orden invita a pedir', () => {
    const { fixture, page } = setup(vi.fn(() => of([])));

    expect(page.errorCarga()).toBeNull();
    expect(nodo(fixture, 'panel-error')).toBeNull();
    expect(nodo(fixture, 'panel-vacio')?.textContent).toContain('Aún no tienes servicios');
    expect(nodo(fixture, 'panel-historial')).toBeNull();
  });

  it('solo historial no muestra vacío', () => {
    const { fixture } = setup(vi.fn(() => of([ot({ estado: 'FINALIZADA' })])));

    expect(nodo(fixture, 'panel-vacio')).toBeNull();
    expect(nodo(fixture, 'orden-activa')).toBeNull();
    expect(nodo(fixture, 'panel-historial')).not.toBeNull();
  });

  it('las órdenes compactas abren su seguimiento', () => {
    const { fixture, navigate } = setup(vi.fn(() => of(otsDeEjemplo())));

    (nodo(fixture, 'panel-ot') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/solicitada');

    (nodo(fixture, 'panel-historial-ot') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/finalizada');
  });

  it('sin ruido: ni filtros, ni contadores, ni Historial como botón, ni frase promocional', () => {
    const { fixture } = setup(vi.fn(() => of(otsDeEjemplo())));

    for (const id of ['panel-filtros', 'panel-equipos', 'panel-total-activas', 'panel-subtitulo']) {
      expect(nodo(fixture, id)).toBeNull();
    }
    expect(texto(fixture)).not.toContain('Pide un servicio y sigue');
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
    expect(todos(fixture, 'orden-activa')).toHaveLength(1);
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
    expect(texto(fixture)).toContain('Todavía no tienes perfil de cliente');
    // El 404 de perfil no es un error de carga ni un listado vacío genérico.
    expect(fixture.nativeElement.querySelector('[data-testid="panel-error"]')).toBeNull();

    const cta = fixture.nativeElement.querySelector(
      '[data-testid="panel-crear-perfil"]',
    ) as HTMLElement;
    cta.click();

    expect(navigate).toHaveBeenCalledWith('/cliente/solicitar');
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
      expect(idsVisibles(page)).toEqual(['a']);
    });

    it('un refresco cambia la orden grande', () => {
      cambiarPestana('visible');
      const camino = ot({ id: 'camino', estado: 'EN_CAMINO', tecnicoId: 't' });
      const pago = ot({ id: 'pago', estado: 'ASIGNADA', tecnicoId: 't', visitaPagada: false });
      const getOts = vi
        .fn()
        .mockReturnValueOnce(of([camino]))
        .mockReturnValue(of([camino, pago]));
      const { fixture, page } = setup(getOts);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      fixture.detectChanges();

      expect(page.activa()?.id).toBe('pago');
      expect(nodo(fixture, 'orden-activa-accion')?.textContent?.trim()).toBe('Pagar la visita');
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
      expect(idsVisibles(page)).toEqual(['a']);
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
