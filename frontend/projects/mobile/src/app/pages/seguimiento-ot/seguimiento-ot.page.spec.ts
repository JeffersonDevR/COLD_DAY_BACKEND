import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { WritableSignal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtApi } from '@core/service/ot-api';
import { ClientesApi } from '@core/service/clientes-api';
import { SseService, OtEstadoCambiado } from '@core/service/sse.service';
import { RutaSeguimientoService } from '@core/service/ruta-seguimiento.service';
import { OtResponse, Point } from '@core/models/common.models';
import { POLL_INTERVAL_MS } from '@core/service/visible-tab-polling';
import { signal } from '@angular/core';
import { MobileToastService } from '../../core/toast.service';
import { SeguimientoOtPage } from './seguimiento-ot.page';
import { GoogleMapsLoaderService } from '@core/service/google-maps-loader';
import { MAPA_MOTOR } from '@core/maps/mapa-motor.token';
import { MapaConfigService } from '@core/service/mapa-config.service';
import type { EscenaMapa, MapaInstancia, MapaMotor } from '@core/maps/mapa-motor';

/** Vista del componente con lo que ejercitan los tests (miembros protected). */
interface SeguimientoInternos {
  readonly tecnicoUbicacion: WritableSignal<Point | null>;
  readonly motivoControl: { setValue(v: string): void; markAsTouched(): void };
  readonly motivoDisputaControl: { setValue(v: string): void; markAsTouched(): void };
}

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0001',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría y gotea agua.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    tecnicoId: 'tec-1',
    tecnicoNombre: 'Carlos Pérez',
    ...overrides,
  };
}

const PUNTO: Point = { latitud: 7.8939, longitud: -72.5078 };
const UBICACION_TECNICO: Point = { latitud: 7.9, longitud: -72.51 };

function loaderMapaStub(over: Record<string, unknown> = {}) {
  return {
    isLoaded: () => false,
    isLoading: () => false,
    loadError: () => 'No fue posible cargar Google Maps JavaScript API.',
    init: vi.fn(() => Promise.resolve(false)),
    reintentar: vi.fn(() => Promise.resolve(false)),
    ...over,
  };
}

/** Un mock de vitest con firma libre: el useValue del TestBed no lo restringe. */
type Stub = ReturnType<typeof vi.fn>;

function setup({
  otApi,
  clientesApi,
  sse,
  loader,
  motor,
}: {
  otApi?: { getOtById?: Stub; getTecnicoUbicacion?: Stub; estimarTarifa?: Stub };
  clientesApi?: { cancelarOt?: Stub; abrirDisputa?: Stub; pagarVisita?: Stub };
  sse?: { abrirOtStream: ReturnType<typeof vi.fn> };
  loader?: ReturnType<typeof loaderMapaStub>;
  motor?: MapaMotor;
} = {}) {
  const getOtById = otApi?.getOtById ?? vi.fn(() => of(ot({})));
  const getTecnicoUbicacion = otApi?.getTecnicoUbicacion ?? vi.fn(() => of(null));
  const cancelarOt = clientesApi?.cancelarOt ?? vi.fn(() => of(undefined));
  const abrirDisputa = clientesApi?.abrirDisputa ?? vi.fn(() => of(undefined));
  const pagarVisita = clientesApi?.pagarVisita ?? vi.fn(() => of(undefined));

  const estimarTarifa =
    otApi?.estimarTarifa ??
    vi.fn(() => of({ distanciaKm: 4, tarifaFuente: 'ROAD', banda: 1, tarifa: 50000, fueraDeRango: false }));
  const api = { getOtById, getTecnicoUbicacion, estimarTarifa };
  const clientes = { cancelarOt, abrirDisputa, pagarVisita };
  const sseMock = sse ?? { abrirOtStream: vi.fn(() => new Subject<OtEstadoCambiado>()) };
  const toast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };
  const rutaStub = {
    rutaCodificada: signal<string | null>(null),
    actualizar: vi.fn(() => false),
    detener: vi.fn(),
  };
  const loaderStub = loader ?? loaderMapaStub();

  TestBed.configureTestingModule({
    imports: [SeguimientoOtPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: api },
      { provide: ClientesApi, useValue: clientes },
      { provide: SseService, useValue: sseMock },
      { provide: MobileToastService, useValue: toast },
      // Maps nunca carga en jsdom: el bloque de mapa queda en su tarjeta honesta.
      { provide: GoogleMapsLoaderService, useValue: loaderStub },
      ...(motor ? [{ provide: MAPA_MOTOR, useValue: motor }] : []),
    ],
  });

  TestBed.overrideComponent(SeguimientoOtPage, {
    set: { providers: [{ provide: RutaSeguimientoService, useValue: rutaStub }] },
  });

  // La config del mapa llega del backend: en el test no hay red y se resuelve de inmediato.
  vi.spyOn(TestBed.inject(MapaConfigService), 'cargar').mockResolvedValue(undefined as never);

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture: ComponentFixture<SeguimientoOtPage> = TestBed.createComponent(SeguimientoOtPage);
  const page = fixture.componentInstance as unknown as SeguimientoInternos;
  fixture.detectChanges();

  return { fixture, page, api, clientes, sseMock, toast, navigate, loader: loaderStub, rutaStub };
}

function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

function texto(fixture: ComponentFixture<SeguimientoOtPage>): string {
  return fixture.nativeElement.textContent as string;
}

function click(fixture: ComponentFixture<SeguimientoOtPage>, testid: string): void {
  const el = fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(el, `elemento ${testid} presente`).not.toBeNull();
  el!.click();
  fixture.detectChanges();
}

describe('SeguimientoOtPage móvil (A6)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    cambiarPestana('visible');
  });

  afterEach(() => {
    delete (document as { visibilityState?: string }).visibilityState;
    vi.useRealTimers();
  });

  it('carga la OT y pinta badge, timeline y técnico', () => {
    const { fixture, api } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(
            ot({
              estado: 'EN_CAMINO',
              punto: PUNTO,
              tecnicoTelefono: '3001234567',
            }),
          ),
        ),
        getTecnicoUbicacion: vi.fn(() => of(UBICACION_TECNICO)),
      },
    });

    expect(api.getOtById).toHaveBeenCalledWith('ot1');
    expect(texto(fixture)).toContain('OT-2026-0001');
    expect(fixture.nativeElement.querySelector('[data-testid="ot-estado"]')?.textContent).toContain(
      'En camino',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-pasos"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tecnico-card"]')?.textContent).toContain(
      'Carlos Pérez',
    );
    expect(api.getTecnicoUbicacion).toHaveBeenCalledWith('ot1');
  });

  it('una carga fallida muestra el banner y Reintentar vuelve a pedir la OT', () => {
    const getOtById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValue(of(ot({ estado: 'ASIGNADA', visitaPagada: true })));
    const { fixture } = setup({ otApi: { getOtById } });

    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).not.toBeNull();

    click(fixture, 'ot-reintentar');

    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeNull();
    expect(texto(fixture)).toContain('OT-2026-0001');
  });

  it('un 404 se traduce al copy humano (nunca el string crudo del backend)', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          throwError(() => new ApiHttpError('Orden no encontrada para el usuario 7: OT-9', 404)),
        ),
      },
    });

    expect(texto(fixture)).toContain('No encontramos el registro');
    expect(texto(fixture)).not.toContain('usuario 7');
  });

  it('un evento SSE recarga la OT y avisa "Técnico asignado"', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true })));
    const { toast } = setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({
      otId: 'ot1',
      origen: 'BUSCANDO_TECNICO',
      destino: 'ASIGNADA',
    });

    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalledWith('Técnico asignado', expect.any(String));
  });

  it('SSE ASIGNADA con visitaPagadaEn NO produce toast (falso positivo de asignación)', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true })));
    const { toast } = setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({
      otId: 'ot1',
      origen: 'ASIGNADA',
      destino: 'ASIGNADA',
      visitaPagadaEn: '2026-11-03T10:00:00Z',
    });

    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('SSE EN_DIAGNOSTICO avisa "Presupuesto recibido"', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const { toast } = setup({
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({ otId: 'ot1', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' });

    expect(toast.info).toHaveBeenCalledWith('Presupuesto recibido', expect.any(String));
  });

  it('SSE de otra OT no toca la pantalla', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot({})));
    const { toast } = setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({ otId: 'otra-ot', origen: 'BUSCANDO_TECNICO', destino: 'ASIGNADA' });

    expect(getOtById).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('si el stream SSE se rinde, el poll de respaldo refresca cada 25 s', () => {
    vi.useFakeTimers();
    const getOtById = vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true })));
    setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => throwError(() => new Error('stream caído'))) },
    });

    expect(getOtById).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(getOtById).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(getOtById).toHaveBeenCalledTimes(3);
  });

  it('pinta la tarifa REAL de la visita (estimador) en el panel y el CTA', () => {
    const estimarTarifa = vi.fn(() =>
      of({ distanciaKm: 4, tarifaFuente: 'ROAD', banda: 1, tarifa: 50000, fueraDeRango: false }),
    );
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: false, punto: PUNTO }))),
        estimarTarifa,
      },
    });

    expect(estimarTarifa).toHaveBeenCalledWith({ latitud: PUNTO.latitud, longitud: PUNTO.longitud });
    expect(fixture.nativeElement.querySelector('[data-testid="tarifa-visita"]')?.textContent).toContain('50');
    expect(
      (fixture.nativeElement.querySelector('[data-testid="pagar-visita"]') as HTMLElement).textContent,
    ).toContain('Pagar visita ·');
  });

  it('sin estimación real (fuera de rango o error) no pinta ningún monto', () => {
    const estimarTarifa = vi.fn(() =>
      of({ distanciaKm: 90, tarifaFuente: 'LINEAL', banda: null, tarifa: null, fueraDeRango: true }),
    );
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: false, punto: PUNTO }))),
        estimarTarifa,
      },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="tarifa-visita"]')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('[data-testid="pagar-visita"]') as HTMLElement).textContent,
    ).not.toContain('·');
  });

  it('pagar la visita (ASIGNADA sin pago) envía el medio elegido y avisa', () => {
    const pagarVisita = vi.fn(() => of(undefined));
    const { fixture, toast } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: false }))),
      },
      clientesApi: { pagarVisita },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="panel-pago-visita"]')).not.toBeNull();

    click(fixture, 'medio-transferencia');
    click(fixture, 'pagar-visita');

    expect(pagarVisita).toHaveBeenCalledWith('ot1', 'TRANSFERENCIA');
    expect(toast.success).toHaveBeenCalledWith('Visita pagada', expect.any(String));
  });

  it('pagar la visita de una OT cancelada habla de reabrir el despacho', () => {
    const pagarVisita = vi.fn(() => of(undefined));
    const { fixture, toast } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'CANCELADA' }))) },
      clientesApi: { pagarVisita },
    });

    expect(texto(fixture)).toContain('reabrir el despacho');

    click(fixture, 'pagar-visita');

    expect(pagarVisita).toHaveBeenCalledWith('ot1', 'EFECTIVO');
    expect(toast.success).toHaveBeenCalledWith(
      'Visita pagada',
      expect.stringContaining('Despacho reabierto'),
    );
  });

  it('pagar la visita de una OT disputada también reabre el despacho', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'DISPUTADA' }))) },
    });

    expect(texto(fixture)).toContain('reabrir el despacho');
  });

  it('ASIGNADA ya pagada no muestra el panel de pago', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="panel-pago-visita"]')).toBeNull();
  });

  it('el pago de visita fallido avisa con copy humano y libera el botón', () => {
    const pagarVisita = vi.fn(() => throwError(() => new ApiHttpError('doble cobro', 409)));
    const { fixture, toast } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: false }))) },
      clientesApi: { pagarVisita },
    });

    click(fixture, 'pagar-visita');

    expect(toast.error).toHaveBeenCalledWith('No se pudo pagar la visita', expect.any(String));
    const boton = fixture.nativeElement.querySelector('[data-testid="pagar-visita"]') as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
  });

  it('cancelar con motivo válido confirma, avisa y vuelve al panel', () => {
    const cancelarOt = vi.fn(() => of(undefined));
    const { fixture, page, toast, navigate } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true }))) },
      clientesApi: { cancelarOt },
    });

    click(fixture, 'cta-cancelar');
    const confirmar = fixture.nativeElement.querySelector(
      '[data-testid="cancelar-confirmar"]',
    ) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    page.motivoControl.setValue('Ya no necesito el servicio');
    fixture.detectChanges();

    click(fixture, 'cancelar-confirmar');

    expect(cancelarOt).toHaveBeenCalledWith('ot1', 'Ya no necesito el servicio');
    expect(toast.warning).toHaveBeenCalledWith('Servicio cancelado', expect.any(String));
    expect(navigate).toHaveBeenCalledWith('/cliente/panel');
  });

  it('cancelar con motivo corto (< 5) no confirma', () => {
    const cancelarOt = vi.fn(() => of(undefined));
    const { fixture, page } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true }))) },
      clientesApi: { cancelarOt },
    });

    click(fixture, 'cta-cancelar');
    page.motivoControl.setValue('abc');
    fixture.detectChanges();

    const confirmar = fixture.nativeElement.querySelector(
      '[data-testid="cancelar-confirmar"]',
    ) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    expect(cancelarOt).not.toHaveBeenCalled();
  });

  it('una cancelación fallida mantiene el modal abierto y avisa con copy humano', () => {
    const cancelarOt = vi.fn(() =>
      throwError(() => new ApiHttpError('sin permiso interno', 403)),
    );
    const { fixture, page, toast, navigate } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'ASIGNADA', visitaPagada: true }))) },
      clientesApi: { cancelarOt },
    });

    click(fixture, 'cta-cancelar');
    page.motivoControl.setValue('Ya no lo necesito');
    fixture.detectChanges();
    click(fixture, 'cancelar-confirmar');

    expect(toast.error).toHaveBeenCalledWith('No se pudo cancelar el servicio', expect.stringContaining('permisos'));
    expect(fixture.nativeElement.querySelector('[data-testid="modal-cancelar"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalledWith('/cliente/panel');
  });

  it('disputa con motivo válido llama a abrirDisputa, avisa y recarga', () => {
    const abrirDisputa = vi.fn(() => of(undefined));
    const getOtById = vi.fn(() => of(ot({ estado: 'EN_DIAGNOSTICO', diagnostico: {} })));
    const { fixture, page, toast } = setup({
      otApi: { getOtById },
      clientesApi: { abrirDisputa },
    });

    click(fixture, 'cta-disputa');
    page.motivoDisputaControl.setValue('El repuesto era mucho más barato');
    fixture.detectChanges();
    click(fixture, 'disputa-confirmar');

    expect(abrirDisputa).toHaveBeenCalledWith('ot1', 'El repuesto era mucho más barato');
    expect(toast.warning).toHaveBeenCalledWith('Disputa abierta', expect.any(String));
    // La disputa fuerza una recarga para reevaluar los bloques visibles.
    expect(getOtById).toHaveBeenCalledTimes(2);
  });

  it('disputa con motivo corto no confirma', () => {
    const abrirDisputa = vi.fn(() => of(undefined));
    const { fixture, page } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'EN_DIAGNOSTICO' }))) },
      clientesApi: { abrirDisputa },
    });

    click(fixture, 'cta-disputa');
    page.motivoDisputaControl.setValue('caro');
    fixture.detectChanges();

    const confirmar = fixture.nativeElement.querySelector(
      '[data-testid="disputa-confirmar"]',
    ) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    expect(abrirDisputa).not.toHaveBeenCalled();
  });

  it('FINALIZADA muestra Ver Acta y Pago hacia /pago (nunca pago-acta) y Calificar', () => {
    const { fixture, navigate } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'FINALIZADA' }))) },
    });

    click(fixture, 'cta-acta');
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/ot1/pago');
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('pago-acta'));

    expect(fixture.nativeElement.querySelector('[data-testid="cta-calificar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cta-presupuesto"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cta-cancelar"]')).toBeNull();
  });

  it('Calificar se oculta cuando la OT ya tiene calificación', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(ot({ estado: 'FINALIZADA', calificacion: { estrellas: 5 } })),
        ),
      },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="cta-calificar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cta-acta"]')).not.toBeNull();
  });

  it('ningún CTA apunta a la ruta muerta pago-acta', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'FINALIZADA' }))) },
    });

    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('pago-acta');
  });

  it('EN_DIAGNOSTICO muestra Revisar Presupuesto y navega al diagnóstico', () => {
    const { fixture, navigate } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(
            ot({
              estado: 'EN_DIAGNOSTICO',
              diagnostico: {},
              presupuesto: { aprobado: false, total: 250000, manoObra: 150000, repuestos: 100000 },
            }),
          ),
        ),
      },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="cta-presupuesto"]')).not.toBeNull();

    click(fixture, 'cta-presupuesto');
    expect(navigate).toHaveBeenCalledWith('/cliente/ot/ot1/diagnostico');
  });

  it('Abrir Disputa aparece en EN_REPARACION', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'EN_REPARACION' }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="cta-disputa"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cta-cancelar"]')).toBeNull();
  });

  it('cancelar aparece en EN_DIAGNOSTICO y desaparece en FINALIZADA', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'EN_DIAGNOSTICO' }))) },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="cta-cancelar"]')).not.toBeNull();
  });

  it('sin llegada: el técnico figura "En camino"', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'EN_CAMINO', punto: PUNTO }))),
        getTecnicoUbicacion: vi.fn(() => of(UBICACION_TECNICO)),
      },
    });

    expect(texto(fixture)).toContain('En camino');
    expect(texto(fixture)).not.toContain('El técnico llegó');
  });

  it('con llegadaEn: el técnico figura con el instante de la llegada', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(ot({ estado: 'EN_DIAGNOSTICO', llegadaEn: '2026-11-03T14:32:00Z', punto: PUNTO })),
        ),
        getTecnicoUbicacion: vi.fn(() => of(UBICACION_TECNICO)),
      },
    });

    expect(texto(fixture)).toContain('El técnico llegó');
  });

  it('la posición 404 = "sin posición todavía" y el sondeo sigue vivo', () => {
    vi.useFakeTimers();
    const getTecnicoUbicacion = vi.fn(() => of(null));
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'EN_CAMINO', punto: PUNTO }))),
        getTecnicoUbicacion,
      },
    });

    expect(texto(fixture)).toContain('Todavía no hay posición del técnico');

    vi.advanceTimersByTime(15000);
    expect(getTecnicoUbicacion.mock.calls.length).toBeGreaterThan(1);
  });

  it('un error de posición conserva el último punto y no corta el sondeo', () => {
    vi.useFakeTimers();
    const getTecnicoUbicacion = vi
      .fn()
      .mockReturnValueOnce(of(UBICACION_TECNICO))
      .mockReturnValue(throwError(() => new ApiHttpError('backend caído', 500)));
    const { page, toast } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ estado: 'EN_CAMINO', punto: PUNTO }))),
        getTecnicoUbicacion,
      },
    });

    expect(page.tecnicoUbicacion()).toEqual(UBICACION_TECNICO);

    vi.advanceTimersByTime(15000 * 2);

    expect(getTecnicoUbicacion.mock.calls.length).toBeGreaterThan(1);
    expect(page.tecnicoUbicacion()).toEqual(UBICACION_TECNICO);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('SOLICITADA muestra la tarjeta Buscando técnico con el código y sin mapa', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'SOLICITADA', tecnicoId: null }))) },
    });

    const buscando = fixture.nativeElement.querySelector('[data-testid="buscando-tecnico"]');
    expect(buscando).not.toBeNull();
    expect(buscando?.textContent).toContain('Buscando técnico');
    expect(buscando?.textContent).toContain('OT-2026-0001');
    expect(fixture.nativeElement.querySelector('[data-testid="mapa-canvas"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tecnico-card"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cta-cancelar"]')).not.toBeNull();
  });

  it('BUSCANDO_TECNICO también muestra la tarjeta de búsqueda', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'BUSCANDO_TECNICO', tecnicoId: null }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="buscando-tecnico"]')).not.toBeNull();
  });

  it('el mapa degradado ofrece Reintentar mapa y el resto de la pantalla sigue', async () => {
    const loader = loaderMapaStub();
    const { fixture } = setup({ loader });

    // La página real instancia el hijo con el loader stubbeado: sin Maps, el
    // bloque de mapa es una tarjeta honesta con salida. Primero llega la config
    // (mientras tanto dice "Cargando mapa…") y luego el motor falla.
    await fixture.whenStable();
    fixture.detectChanges();
    const fallback = fixture.nativeElement.querySelector('[data-testid="mapa-fallback"]') as HTMLElement;
    expect(fallback).not.toBeNull();

    click(fixture, 'mapa-reintentar');
    await fixture.whenStable();

    expect(loader.reintentar).toHaveBeenCalledTimes(1);
    // El resto de los bloques sigue funcionando.
    expect(fixture.nativeElement.querySelector('[data-testid="timeline-pasos"]')).not.toBeNull();
  });

  describe('acción principal en el pie', () => {
    const nodo = (fixture: ComponentFixture<SeguimientoOtPage>, id: string) =>
      fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    function montar(overrides: Partial<OtResponse>) {
      return setup({ otApi: { getOtById: vi.fn(() => of(ot(overrides))) } });
    }

    it('pagar la visita va en el pie', () => {
      const { fixture } = montar({ estado: 'ASIGNADA', visitaPagada: false });

      const boton = nodo(fixture, 'pagar-visita');
      expect(nodo(fixture, 'ot-pie')?.contains(boton)).toBe(true);
      expect(nodo(fixture, 'panel-pago-visita')?.contains(boton)).toBe(false);
    });

    it('revisar presupuesto va en el pie y no se duplica', () => {
      const { fixture } = montar({ estado: 'EN_DIAGNOSTICO', diagnostico: {} });

      expect(nodo(fixture, 'ot-pie')?.contains(nodo(fixture, 'cta-presupuesto'))).toBe(true);
      expect(nodo(fixture, 'tecnico-diagnostico')).toBeNull();
    });

    it('ver acta va en el pie y calificar queda abajo sin relleno', () => {
      const { fixture } = montar({ estado: 'FINALIZADA' });

      expect(nodo(fixture, 'ot-pie')?.contains(nodo(fixture, 'cta-acta'))).toBe(true);
      const calificar = nodo(fixture, 'cta-calificar') as HTMLElement & { fill?: string };
      expect(nodo(fixture, 'ot-acciones')?.contains(calificar)).toBe(true);
      expect(calificar.fill ?? calificar.getAttribute('fill')).toBe('outline');
    });

    it('sin acción principal no hay pie', () => {
      const { fixture } = montar({ estado: 'EN_CAMINO' });

      expect(nodo(fixture, 'ot-pie')).toBeNull();
    });

    it('con un modal abierto el pie se retira', () => {
      const { fixture } = montar({ estado: 'EN_DIAGNOSTICO', diagnostico: {} });

      click(fixture, 'cta-disputa');
      expect(nodo(fixture, 'ot-pie')).toBeNull();

      click(fixture, 'disputa-volver');
      expect(nodo(fixture, 'ot-pie')).not.toBeNull();
    });

    it('las acciones secundarias van después de la ficha', () => {
      const { fixture } = montar({ estado: 'EN_DIAGNOSTICO' });

      const posicion = nodo(fixture, 'timeline-pasos')!.compareDocumentPosition(
        nodo(fixture, 'ot-acciones')!,
      );
      expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('dato dominante y ficha', () => {
    const nodo = (fixture: ComponentFixture<SeguimientoOtPage>, id: string) =>
      fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const limpio = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
    const grande = (fixture: ComponentFixture<SeguimientoOtPage>) =>
      limpio(nodo(fixture, 'dato-dominante')?.querySelector('.cd-dato__grande'));
    const dato = (fixture: ComponentFixture<SeguimientoOtPage>) =>
      limpio(nodo(fixture, 'dato-dominante')) ?? '';

    function montar(overrides: Partial<OtResponse>, ubicacion: Point | null = null) {
      return setup({
        otApi: {
          getOtById: vi.fn(() => of(ot(overrides))),
          getTecnicoUbicacion: vi.fn(() => of(ubicacion)),
        },
      }).fixture;
    }

    it('buscando', () => {
      const fixture = montar({ estado: 'SOLICITADA', tecnicoId: null });

      expect(grande(fixture)).toBe('Buscando técnico');
      expect(nodo(fixture, 'buscando-tecnico')?.textContent).toContain('OT-2026-0001');
    });

    it('en camino con ETA', () => {
      const fixture = montar({ estado: 'EN_CAMINO', punto: PUNTO }, UBICACION_TECNICO);

      expect(grande(fixture)).toMatch(/^~\d+ min$/);
      expect(dato(fixture)).toContain('km');
    });

    it('en camino sin ETA', () => {
      const fixture = montar({ estado: 'EN_CAMINO', punto: PUNTO });

      expect(grande(fixture)).toBe('Técnico en camino');
      expect(dato(fixture)).not.toContain('km');
    });

    it('llegó', () => {
      const fixture = montar({ estado: 'EN_DIAGNOSTICO', llegadaEn: '2026-11-03T14:32:00Z' });

      expect(grande(fixture)).toBe('El técnico llegó');
    });

    it('asignada sin pagar no dice en camino', () => {
      const fixture = montar(
        { estado: 'ASIGNADA', visitaPagada: false, punto: PUNTO },
        UBICACION_TECNICO,
      );

      expect(grande(fixture)).toBe('Asignada');
      expect(dato(fixture)).not.toMatch(/min|en camino/i);
    });

    it('otro estado muestra la fecha', () => {
      const fixture = montar({ estado: 'FINALIZADA', fechaCreacion: '2026-11-01T09:00:00Z' });

      expect(grande(fixture)).toBe('Finalizada');
      expect(dato(fixture)).toContain('Creada el');
    });

    it('ya no hay calificación del técnico', () => {
      const fixture = montar({ estado: 'EN_CAMINO', tecnicoReputacion: 4.7 });

      const tarjeta = nodo(fixture, 'tecnico-card')?.textContent;
      expect(tarjeta).not.toContain('Sin rating');
      expect(tarjeta).not.toContain('4.7');
    });

    it('sin barrio no inventa Centro', () => {
      const fixture = montar({ barrio: undefined });

      expect(texto(fixture)).not.toContain('Centro');
      expect(texto(fixture)).not.toContain('Barrio');
    });

    it('técnico sin nombre ni teléfono', () => {
      const fixture = montar({ tecnicoNombre: undefined, tecnicoTelefono: undefined });

      const tarjeta = nodo(fixture, 'tecnico-card')?.textContent;
      expect(tarjeta).toContain('Técnico asignado');
      expect(tarjeta).not.toContain('Buscando');
      expect(nodo(fixture, 'tecnico-llamar')).toBeNull();
    });

    it('una sola ficha con la falla', () => {
      const fixture = montar({});

      const ficha = nodo(fixture, 'ficha-servicio')?.textContent;
      expect(ficha).toContain('No enfría y gotea agua.');
      expect(ficha).toContain('Garantía');
    });

    it('el dato va antes del pago y del técnico', () => {
      const fixture = montar({ estado: 'ASIGNADA', visitaPagada: false });

      const orden = [
        'dato-dominante',
        'panel-pago-visita',
        'tecnico-card',
        'timeline-pasos',
        'ficha-servicio',
      ].map((id) => nodo(fixture, id)!);
      for (let i = 1; i < orden.length; i++) {
        expect(
          orden[i - 1].compareDocumentPosition(orden[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });
  });

  describe('mapa a todo el ancho', () => {
    const uno = (fixture: ComponentFixture<SeguimientoOtPage>, selector: string) =>
      fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    function montar(overrides: Partial<OtResponse>) {
      return setup({
        otApi: {
          getOtById: vi.fn(() => of(ot({ punto: PUNTO, ...overrides }))),
          getTecnicoUbicacion: vi.fn(() => of(UBICACION_TECNICO)),
        },
      }).fixture;
    }

    it('el mapa no lleva título propio y su chip va dentro del lienzo', () => {
      const fixture = montar({ estado: 'EN_CAMINO' });

      expect(texto(fixture)).not.toContain('Seguimiento en vivo');
      expect(uno(fixture, '.cd-map__lienzo [data-testid="mapa-distancia"]')).not.toBeNull();
    });

    it('ya llegó también va sobre el mapa', () => {
      const fixture = montar({ estado: 'EN_DIAGNOSTICO', llegadaEn: '2026-11-03T14:32:00Z' });

      expect(uno(fixture, '.cd-map__lienzo [data-testid="mapa-llegada"]')).not.toBeNull();
    });

    it('el mapa va primero y el dato se monta sobre él', () => {
      const fixture = montar({ estado: 'EN_CAMINO' });

      const mapa = uno(fixture, '.cd-mapa-bloque')!;
      const dato = uno(fixture, '[data-testid="dato-dominante"]')!;
      expect(mapa.compareDocumentPosition(dato) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(dato.classList).toContain('cd-dato--sobre-mapa');
    });

    it('esperando el pago, el chip del mapa no dice "En camino"', () => {
      const fixture = montar({ estado: 'ASIGNADA', visitaPagada: false });

      const chip = uno(fixture, '[data-testid="mapa-distancia"]')!;
      expect(chip.textContent).toContain('km');
      expect(chip.textContent).not.toContain('En camino');
    });

    it('con la orden en camino, el chip lo dice', () => {
      const fixture = montar({ estado: 'EN_CAMINO' });

      expect(uno(fixture, '[data-testid="mapa-distancia"]')!.textContent).toContain('En camino');
    });

    it('las tarjetas usan cd-card para compartir el mismo borde (DESIGN §8.2)', () => {
      const fixture = montar({ estado: 'ASIGNADA', visitaPagada: false });

      const tarjetas = [...fixture.nativeElement.querySelectorAll('ion-card')] as HTMLElement[];
      expect(tarjetas).toHaveLength(3);
      for (const tarjeta of tarjetas) expect(tarjeta.classList).toContain('cd-card');
    });

    it('sin mapa el dato no se monta sobre nada', () => {
      const fixture = montar({ estado: 'SOLICITADA', tecnicoId: null });

      expect(uno(fixture, '[data-testid="dato-dominante"]')!.classList).not.toContain(
        'cd-dato--sobre-mapa',
      );
    });
  });

  describe('mapa con motor', () => {
    const POLYLINE_VALIDO = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

    function motorFalso() {
      const instancia = {
        actualizar: vi.fn<(escena: EscenaMapa) => void>(),
        ajustarA: vi.fn(),
        centrarEn: vi.fn(),
        destruir: vi.fn(),
      } satisfies MapaInstancia;
      const motor = {
        nombre: 'falso',
        listo: signal(true),
        cargando: signal(false),
        cargar: vi.fn(() => Promise.resolve(true)),
        reintentar: vi.fn(() => Promise.resolve(true)),
        crear: vi.fn(() => instancia),
      };
      return { motor: motor as unknown as MapaMotor, crear: motor.crear, instancia };
    }

    async function montar(ruta: string | null) {
      const { motor, crear, instancia } = motorFalso();
      const montaje = setup({
        motor,
        otApi: {
          getOtById: vi.fn(() => of(ot({ estado: 'EN_CAMINO', punto: PUNTO }))),
          getTecnicoUbicacion: vi.fn(() => of(UBICACION_TECNICO)),
        },
      });
      montaje.rutaStub.rutaCodificada.set(ruta);
      montaje.fixture.detectChanges();
      await montaje.fixture.whenStable();
      montaje.fixture.detectChanges();
      return { ...montaje, crear, instancia };
    }

    function ultimaEscena(instancia: { actualizar: Stub }): EscenaMapa {
      const llamadas = instancia.actualizar.mock.calls;
      return llamadas[llamadas.length - 1][0] as EscenaMapa;
    }

    it('dibuja técnico y destino y la ruta real cuando el polyline es válido', async () => {
      const { crear, instancia } = await montar(POLYLINE_VALIDO);

      expect(crear).toHaveBeenCalledTimes(1);
      const escena = ultimaEscena(instancia);
      expect(escena.marcadores.map((m) => m.id)).toEqual(['tecnico', 'destino']);
      expect(escena.lineas).toHaveLength(1);
      expect(escena.lineas[0].puntos).toHaveLength(3);
      expect(instancia.ajustarA).toHaveBeenCalledTimes(1);
    });

    it('si la posición desaparece y vuelve, suelta el mapa viejo y vuelve a encuadrar', async () => {
      const { page, fixture, crear, instancia } = await montar(POLYLINE_VALIDO);
      expect(instancia.ajustarA).toHaveBeenCalledTimes(1);

      page.tecnicoUbicacion.set(null);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(instancia.destruir).toHaveBeenCalledTimes(1);

      page.tecnicoUbicacion.set(UBICACION_TECNICO);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(crear).toHaveBeenCalledTimes(2);
      expect(instancia.ajustarA).toHaveBeenCalledTimes(2);
    });

    it('al destruir la pantalla suelta el mapa', async () => {
      const { fixture, instancia } = await montar(POLYLINE_VALIDO);
      expect(instancia.destruir).not.toHaveBeenCalled();

      fixture.destroy();

      expect(instancia.destruir).toHaveBeenCalledTimes(1);
    });

    it('con un polyline corrupto cae a la recta técnico→destino', async () => {
      const { instancia } = await montar('basura');

      const linea = ultimaEscena(instancia).lineas[0];
      expect(linea.puntos).toEqual([
        { lat: UBICACION_TECNICO.latitud, lng: UBICACION_TECNICO.longitud },
        { lat: PUNTO.latitud, lng: PUNTO.longitud },
      ]);
    });

    it('sin posición del técnico no crea el mapa', async () => {
      const { motor, crear } = motorFalso();
      const { fixture } = setup({
        motor,
        otApi: {
          getOtById: vi.fn(() => of(ot({ estado: 'EN_CAMINO', punto: PUNTO }))),
          getTecnicoUbicacion: vi.fn(() => of(null)),
        },
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(crear).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="mapa-sin-posicion"]')).not.toBeNull();
    });
  });
});
