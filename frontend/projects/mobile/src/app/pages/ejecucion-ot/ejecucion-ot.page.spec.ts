import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtResponse, SolicitudInsumoResponse } from '@core/models/common.models';
import { SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { OtApi } from '@core/service/ot-api';
import { MobileToastService } from '../../core/toast.service';
import { EjecucionOtPage } from './ejecucion-ot.page';

type Stub = ReturnType<typeof vi.fn>;

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0012',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'ASIGNADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function presenciaStub() {
  return {
    sincronizarOt: vi.fn(),
    liberarContexto: vi.fn(),
    modo: signal('ejecutando'),
    compartirUbicacion: signal(true),
    switchBloqueado: signal(true),
    reportando: signal(true),
    motivo: signal<string | null>(null),
    sincronizarOts: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    reintentar: vi.fn(),
  };
}

function setup({
  orden = ot(),
  tecnicos,
  getOtById,
}: {
  orden?: OtResponse;
  tecnicos?: Record<string, Stub>;
  getOtById?: Stub;
} = {}) {
  const api = {
    getOtById: getOtById ?? vi.fn(() => of(orden)),
    getInsumosOt: vi.fn(() => of([])),
    estimarTarifa: vi.fn(() => of({ tarifa: 30000, fueraDeRango: false })),
    iniciarDesplazamiento: vi.fn(() => of(undefined)),
    llegarADomicilio: vi.fn(() => of(undefined)),
    registrarDiagnostico: vi.fn(() => of(undefined)),
    finalizarServicio: vi.fn(() => of(undefined)),
    ...tecnicos,
  };
  const presencia = presenciaStub();
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const sse = { abrirOtStream: vi.fn(() => new Subject()) };

  TestBed.configureTestingModule({
    imports: [EjecucionOtPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById: api.getOtById, estimarTarifa: api.estimarTarifa } },
      { provide: TecnicosApi, useValue: api },
      { provide: TecnicoPresenciaService, useValue: presencia },
      { provide: SseService, useValue: sse },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<EjecucionOtPage> = TestBed.createComponent(EjecucionOtPage);
  fixture.detectChanges();

  return { fixture, api, presencia, toast, navigate };
}

function texto(fixture: ComponentFixture<EjecucionOtPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('EjecucionOtPage (B3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const solicitudInsumo = (overrides: Partial<SolicitudInsumoResponse> = {}): SolicitudInsumoResponse => ({
    id: 'req1',
    otId: 'ot1',
    tecnicoId: 'tec1',
    estado: 'SOLICITADO',
    items: [{ descripcion: 'Gas R410A 900g', cantidad: 2 }],
    ...overrides,
  });

  it('muestra el ETA comprometido y el estado de un pedido despachado', () => {
    const { fixture } = setup({
      tecnicos: {
        getInsumosOt: vi.fn(() =>
          of([solicitudInsumo({ estado: 'DESPACHADO', etaMinutos: 35, distanciaKm: 7.5 })]),
        ),
      },
    });
    expect(texto(fixture)).toContain('Despachado');
    const eta = fixture.nativeElement.querySelector('[data-testid="insumo-eta-req1"]');
    expect(eta.textContent).toContain('35 min');
    expect(eta.textContent).toContain('7.5 km');
  });

  it('sin ETA muestra solo el estado', () => {
    const { fixture } = setup({
      tecnicos: { getInsumosOt: vi.fn(() => of([solicitudInsumo({ estado: 'SOLICITADO' })])) },
    });
    expect(texto(fixture)).toContain('Solicitado');
    expect(fixture.nativeElement.querySelector('[data-testid="insumo-eta-req1"]')).toBeNull();
  });

  it('un pedido sin proveedor lo dice y no promete tiempos', () => {
    const { fixture } = setup({
      tecnicos: { getInsumosOt: vi.fn(() => of([solicitudInsumo({ estado: 'SIN_PROVEEDOR' })])) },
    });
    expect(texto(fixture)).toContain('Sin proveedor');
    expect(fixture.nativeElement.querySelector('[data-testid="insumo-eta-req1"]')).toBeNull();
  });

  it('muestra la orden y su estado', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('OT-2026-0012');
    expect(texto(fixture)).toContain('Asignada');
  });

  it('bloquea el desplazamiento si la visita no está paga', () => {
    const { fixture, api, toast } = setup({
      orden: ot({ visitaPagada: false } as Partial<OtResponse>),
    });
    expect(fixture.nativeElement.querySelector('[data-testid="visita-pendiente"]')).toBeTruthy();
    fixture.componentInstance.iniciarDesplazamiento();
    expect(api.iniciarDesplazamiento).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('inicia el desplazamiento cuando la visita está paga', () => {
    const { fixture, api } = setup({
      orden: ot({ visitaPagada: true } as Partial<OtResponse>),
    });
    fixture.componentInstance.iniciarDesplazamiento();
    expect(api.iniciarDesplazamiento).toHaveBeenCalledWith('ot1');
  });

  it('registra la llegada', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_CAMINO' }) });
    fixture.componentInstance.llegarADomicilio();
    expect(api.llegarADomicilio).toHaveBeenCalledWith('ot1');
  });

  it('no envía un diagnóstico inválido', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    fixture.componentInstance.enviarDiagnostico();
    expect(api.registrarDiagnostico).not.toHaveBeenCalled();
  });

  it('envía diagnóstico y presupuesto con los montos', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    const page = fixture.componentInstance;
    page.diagnosticoForm.setValue({
      diagnostico: 'Compresor con fuga.',
      manoDeObra: 200000,
      repuestos: 150000,
    });
    page.enviarDiagnostico();
    expect(api.registrarDiagnostico).toHaveBeenCalledWith('ot1', {
      diagnostico: 'Compresor con fuga.',
      manoDeObra: 200000,
      repuestos: 150000,
      insumos: [],
    });
  });

  it('con el presupuesto ya enviado oculta el formulario y muestra la espera del cliente', () => {
    const { fixture } = setup({
      orden: ot({
        estado: 'EN_DIAGNOSTICO',
        diagnostico: { diagnostico: 'Compresor con fuga.' } as OtResponse['diagnostico'],
        presupuesto: { aprobado: false, total: 350000, manoObra: 200000, manoDeObra: 200000, repuestos: 150000 },
      }),
    });
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('[data-testid="campo-diagnostico"]')).toBeNull();
    expect(html.querySelector('[data-testid="enviar-diagnostico"]')).toBeNull();
    const enviado = html.querySelector('[data-testid="presupuesto-enviado"]');
    expect(enviado).not.toBeNull();
    expect(enviado?.textContent).toContain('esperando');
    expect(enviado?.textContent).toContain('350.000');
    expect(enviado?.textContent).toContain('Compresor con fuga.');
  });

  it('sin presupuesto en diagnóstico el formulario sigue disponible', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('[data-testid="campo-diagnostico"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="presupuesto-enviado"]')).toBeNull();
  });

  it('finaliza el servicio con el medio elegido', () => {
    const { fixture, api, presencia } = setup({ orden: ot({ estado: 'EN_REPARACION' }) });
    fixture.componentInstance.finalizarServicio();
    expect(api.finalizarServicio).toHaveBeenCalledWith('ot1', 'EFECTIVO');
    expect(presencia.liberarContexto).toHaveBeenCalled();
  });

  it('muestra el error de carga con reintentar', () => {
    const { fixture } = setup({
      getOtById: vi.fn(() => throwError(() => new ApiHttpError('No existe', 404))),
    });
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ot-reintentar"]')).toBeTruthy();
  });

  it('el envío incompleto no es silencioso: aviso visible y toast, sin llamada al API', () => {
    const { fixture, api, toast } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });

    fixture.componentInstance.enviarDiagnostico();
    fixture.detectChanges();

    expect(api.registrarDiagnostico).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="diagnostico-incompleto"]')).toBeTruthy();
  });

  it('la búsqueda rápida del catálogo agrega la línea con cantidad 1', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    const page = fixture.componentInstance;

    page.buscarInsumo('gas r410');
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector(
      '[data-testid="catalogo-gas-r410a"]',
    ) as HTMLButtonElement;
    expect(item).toBeTruthy();
    item.click();
    fixture.detectChanges();

    expect(page.insumos.length).toBe(1);
    expect(page.insumos.at(0).getRawValue()).toEqual({
      descripcion: 'Gas refrigerante R410A 900 g',
      cantidad: 1,
    });
    expect(page.busquedaInsumo()).toBe('');
  });

  it('sin resultados el catálogo lo dice y no inventa productos', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    fixture.componentInstance.buscarInsumo('tornillo xyz');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="catalogo-sin-resultados"]')).toBeTruthy();
  });

  it('la foto del equipo no vive en la ejecución del técnico (solo en la solicitud del cliente)', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    expect(fixture.nativeElement.querySelector('app-foto-local')).toBeNull();
  });

  describe('ETA incumplido', () => {
    const AHORA = new Date('2026-09-14T10:00:00Z');
    const haceMinutos = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000).toISOString();
    const asignado = (minutos: number, eta = 30) =>
      solicitudInsumo({ estado: 'ASIGNADO', etaMinutos: eta, aceptadaEn: haceMinutos(minutos) });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(AHORA);
    });
    afterEach(() => vi.useRealTimers());

    function montar(pedidos: SolicitudInsumoResponse[], cambiar?: Stub) {
      const getInsumosOt = vi.fn(() => of(pedidos));
      const cambiarProveedorInsumo = cambiar ?? vi.fn(() => of(solicitudInsumo()));
      const montado = setup({ tecnicos: { getInsumosOt, cambiarProveedorInsumo } });
      const q = (id: string) =>
        montado.fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
      const tocar = (id: string) => {
        q(id)!.click();
        montado.fixture.detectChanges();
      };
      return { ...montado, getInsumosOt, cambiarProveedorInsumo, q, tocar };
    }

    it('no avisa antes de vencer', () => {
      const { q } = montar([asignado(29)]);
      expect(q('eta-vencido-req1')).toBeNull();
    });

    it('no avisa en un pedido despachado aunque haya pasado el tiempo', () => {
      const { q } = montar([solicitudInsumo({ estado: 'DESPACHADO', etaMinutos: 30, aceptadaEn: haceMinutos(60) })]);
      expect(q('eta-vencido-req1')).toBeNull();
    });

    it('con el tiempo vencido dice cuánto prometió y cuánto va', () => {
      const { q } = montar([asignado(38)]);
      expect(q('eta-vencido-req1')!.textContent).toContain('El proveedor no ha despachado');
      expect(q('eta-vencido-req1')!.textContent).toContain('Prometió 30 min · van 38');
    });

    it('seguir esperando pliega el aviso sin llamar al servidor y deja buscar otro a la mano', () => {
      const { q, tocar, cambiarProveedorInsumo } = montar([asignado(38)]);
      tocar('eta-esperar-req1');

      expect(q('eta-vencido-req1')!.textContent).not.toContain('El proveedor no ha despachado');
      expect(q('eta-buscar-req1')).not.toBeNull();
      expect(cambiarProveedorInsumo).not.toHaveBeenCalled();
    });

    it('buscar otro pide confirmación antes de llamar, y llama una sola vez', () => {
      const respuesta = new Subject<SolicitudInsumoResponse>();
      const { q, tocar, fixture, cambiarProveedorInsumo, getInsumosOt, toast } = montar(
        [asignado(38)],
        vi.fn(() => respuesta),
      );
      tocar('eta-buscar-req1');
      expect(q('eta-vencido-req1')!.textContent).toContain('Si nadie más acepta, el pedido queda sin proveedor');
      expect(cambiarProveedorInsumo).not.toHaveBeenCalled();

      tocar('eta-confirmar-cambio-req1');
      fixture.componentInstance.cambiarProveedor(asignado(38));
      expect(cambiarProveedorInsumo).toHaveBeenCalledTimes(1);
      expect(cambiarProveedorInsumo).toHaveBeenCalledWith('req1');

      const cargas = getInsumosOt.mock.calls.length;
      respuesta.next(solicitudInsumo());
      expect(toast.success).toHaveBeenCalled();
      expect(getInsumosOt.mock.calls.length).toBe(cargas + 1);
    });

    it('un 409 muestra el mensaje del servidor y recarga los pedidos', () => {
      const { tocar, getInsumosOt, toast } = montar(
        [asignado(38)],
        vi.fn(() => throwError(() => new ApiHttpError('El proveedor ya despachó el pedido', 409))),
      );
      const cargas = getInsumosOt.mock.calls.length;
      tocar('eta-buscar-req1');
      tocar('eta-confirmar-cambio-req1');

      expect(toast.error).toHaveBeenCalledWith('No se pudo cambiar de proveedor', 'El proveedor ya despachó el pedido');
      expect(getInsumosOt.mock.calls.length).toBe(cargas + 1);
    });

    it('el aviso aparece solo al pasar el tiempo, sin salir de la pantalla', () => {
      const { q, fixture, getInsumosOt } = montar([asignado(29)]);
      expect(q('eta-vencido-req1')).toBeNull();

      vi.advanceTimersByTime(60_000);
      fixture.detectChanges();

      expect(q('eta-vencido-req1')).not.toBeNull();
      expect(getInsumosOt.mock.calls.length).toBeGreaterThan(1);
    });

    it('en una orden cerrada no ofrece buscar otro proveedor', () => {
      const getInsumosOt = vi.fn(() => of([asignado(38)]));
      const { fixture } = setup({ orden: ot({ estado: 'CANCELADA' }), tecnicos: { getInsumosOt } });
      expect(fixture.nativeElement.querySelector('[data-testid="eta-vencido-req1"]')).toBeNull();
    });

    it('tras cambiar de proveedor, el aviso del siguiente vuelve a salir completo', () => {
      const { q, tocar } = montar([asignado(38)]);
      tocar('eta-esperar-req1');
      tocar('eta-buscar-req1');
      tocar('eta-confirmar-cambio-req1');

      expect(q('eta-vencido-req1')!.textContent).toContain('El proveedor no ha despachado');
    });

    it('sin pedidos en curso no sigue consultando', () => {
      const { getInsumosOt } = montar([solicitudInsumo({ estado: 'ENTREGADO' })]);
      vi.advanceTimersByTime(120_000);
      expect(getInsumosOt).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Ejecución: deslizar para recargar', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('tiene el indicador en la pantalla', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('ion-refresher[slot="fixed"]')).not.toBeNull();
  });

  it('trae los datos nuevos', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.api.getOtById.mockReturnValue(of(ot({ codigo: 'OT-NUEVA' })));
    fixture.componentInstance.recargar().subscribe();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('OT-NUEVA');
  });

  it('si falla, entrega el error y conserva lo que se ve', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.api.getOtById.mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));
    const error = vi.fn();
    fixture.componentInstance.recargar().subscribe({ error });
    fixture.detectChanges();
    expect(error).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeNull();
  });

  it('no borra el diagnóstico que se está escribiendo', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    fixture.componentInstance.diagnosticoForm.patchValue({ diagnostico: 'Fuga en la unidad' });

    fixture.componentInstance.recargar().subscribe();

    expect(fixture.componentInstance.diagnosticoForm.value.diagnostico).toBe('Fuga en la unidad');
  });
});

describe('deslizar tras fallar la carga inicial', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('recupera la orden y quita el aviso de error', () => {
    const getOtById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValue(of(ot({ codigo: 'OT-RECUPERADA' })));
    const { fixture } = setup({ getOtById });

    fixture.componentInstance.recargar().subscribe();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('OT-RECUPERADA');
  });
});

describe('ejecución: paso primero y acción en el pie', () => {
  afterEach(() => TestBed.resetTestingModule());

  const nodo = (f: { nativeElement: HTMLElement }, id: string) =>
    f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const precede = (a: HTMLElement, b: HTMLElement) =>
    !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  const enPie = (f: { nativeElement: HTMLElement }, id: string) =>
    !!nodo(f, id)?.closest('ion-footer');

  it.each<[Partial<OtResponse>, string]>([
    [{ estado: 'ASIGNADA', visitaPagada: false }, 'Visita pendiente de pago'],
    [{ estado: 'ASIGNADA', visitaPagada: true }, 'Lista para salir'],
    [{ estado: 'EN_CAMINO' }, 'En camino'],
    [{ estado: 'EN_DIAGNOSTICO' }, 'Diagnóstico'],
    [{ estado: 'EN_REPARACION' }, 'En reparación'],
    [{ estado: 'FINALIZADA' }, 'Servicio finalizado'],
  ])('%o muestra el paso %s con la dirección', (datos, paso) => {
    const { fixture } = setup({ orden: ot(datos) });
    const dato = nodo(fixture, 'dato-dominante')!;

    expect(dato.querySelector('.cd-dato__grande')?.textContent?.trim()).toBe(paso);
    expect(dato.textContent).toContain('Calle 15 # 3E-28');
  });

  it('iniciar desplazamiento va en el pie y sigue bloqueado sin pago', () => {
    const { fixture } = setup({ orden: ot({ estado: 'ASIGNADA', visitaPagada: false }) });
    const boton = nodo(fixture, 'iniciar-desplazamiento') as HTMLElement & { disabled?: boolean };

    expect(enPie(fixture, 'iniciar-desplazamiento')).toBe(true);
    expect(boton.disabled).toBe(true);
  });

  it('llegar y finalizar van en el pie', () => {
    expect(enPie(setup({ orden: ot({ estado: 'EN_CAMINO' }) }).fixture, 'llegar')).toBe(true);
    TestBed.resetTestingModule();
    expect(
      enPie(setup({ orden: ot({ estado: 'EN_REPARACION' }) }).fixture, 'finalizar-servicio'),
    ).toBe(true);
  });

  it('enviar diagnóstico va en el pie y, incompleto, muestra qué falta', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });

    expect(enPie(fixture, 'enviar-diagnostico')).toBe(true);
    nodo(fixture, 'enviar-diagnostico')!.click();
    fixture.detectChanges();

    expect(nodo(fixture, 'diagnostico-incompleto')).not.toBeNull();
    expect(api.registrarDiagnostico).not.toHaveBeenCalled();
  });

  it('con el presupuesto enviado no hay acción en el pie', () => {
    const { fixture } = setup({
      orden: ot({
        estado: 'EN_DIAGNOSTICO',
        presupuesto: { aprobado: false, total: 200000, manoObra: 200000, repuestos: 0 },
      }),
    });

    expect(nodo(fixture, 'dato-dominante')!.textContent).toContain('Esperando al cliente');
    expect(fixture.nativeElement.querySelector('ion-footer')).toBeNull();
  });

  it('antes de cerrar muestra el valor a cobrar: presupuesto más visita', () => {
    const { fixture } = setup({
      orden: ot({
        estado: 'EN_REPARACION',
        tarifaVisita: 30000,
        presupuesto: { aprobado: true, total: 200000, manoObra: 200000, repuestos: 0 },
      }),
    });

    expect(nodo(fixture, 'valor-a-cobrar')!.textContent).toContain('230.000');
    TestBed.resetTestingModule();
    expect(
      nodo(setup({ orden: ot({ estado: 'EN_REPARACION' }) }).fixture, 'valor-a-cobrar'),
    ).toBeNull();
  });
});

describe('deslizar cuando fallan solo los insumos', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('actualiza la orden igual y no entrega error', () => {
    const { fixture, api } = setup();
    api.getOtById.mockReturnValue(of(ot({ codigo: 'OT-NUEVA' })));
    api.getInsumosOt.mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));
    const error = vi.fn();

    fixture.componentInstance.recargar().subscribe({ error });
    fixture.detectChanges();

    expect(error).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('OT-NUEVA');
  });
});

describe('doble toque en los pasos', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([
    ['iniciarDesplazamiento', ot({ estado: 'ASIGNADA', visitaPagada: true })],
    ['llegarADomicilio', ot({ estado: 'EN_CAMINO' })],
  ] as const)('%s no se envía dos veces', (metodo, orden) => {
    const espera = new Subject<void>();
    const api = vi.fn(() => espera);
    const { fixture } = setup({ orden, tecnicos: { [metodo]: api } });

    fixture.componentInstance[metodo]();
    fixture.componentInstance[metodo]();

    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe('cierre con cobro', () => {
  afterEach(() => TestBed.resetTestingModule());

  const nodo = (f: { nativeElement: HTMLElement }, id: string) =>
    f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const orden = () =>
    ot({
      estado: 'EN_REPARACION',
      punto: { latitud: 7.89, longitud: -72.5 },
      presupuesto: { aprobado: true, total: 200000, manoObra: 200000, repuestos: 0 },
    });

  it('estima la visita, muestra la comisión y avisa del bloqueo', () => {
    const { fixture } = setup({ orden: orden() });

    expect(nodo(fixture, 'valor-a-cobrar')!.textContent).toContain('230.000');
    expect(nodo(fixture, 'comision-a-consignar')!.textContent).toContain('34.500');
    expect(nodo(fixture, 'comision-a-consignar')!.textContent).toContain('hasta consignar');
    expect(nodo(fixture, 'finalizar-servicio')!.textContent).toContain('Finalizar y cobrar');
  });

  it('sin estimación no inventa el total', () => {
    const { fixture } = setup({
      orden: orden(),
      tecnicos: { estimarTarifa: vi.fn(() => throwError(() => new ApiHttpError('boom', 500))) },
    });

    expect(nodo(fixture, 'valor-a-cobrar')!.textContent).toContain('más la visita');
    expect(nodo(fixture, 'comision-a-consignar')!.textContent).not.toContain('30.000');
  });
});
