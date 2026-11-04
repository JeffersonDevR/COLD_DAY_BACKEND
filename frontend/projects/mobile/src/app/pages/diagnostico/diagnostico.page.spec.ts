import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtApi } from '@core/service/ot-api';
import { ClientesApi } from '@core/service/clientes-api';
import { SseService, OtEstadoCambiado } from '@core/service/sse.service';
import { OtResponse, TarifaEstimadaResponse } from '@core/models/common.models';
import { POLL_INTERVAL_MS } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';
import { DiagnosticoPage } from './diagnostico.page';

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0007',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría y gotea agua.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'EN_DIAGNOSTICO',
    auxiliaresRequeridos: 0,
    tecnicoId: 'tec-1',
    tecnicoNombre: 'Carlos Pérez',
    diagnostico: { diagnostico: 'Compresor con fuga de refrigerante en la línea de baja.' },
    presupuesto: { aprobado: false, total: 350000, manoObra: 200000, repuestos: 150000 },
    ...overrides,
  };
}

const ESTIMACION: TarifaEstimadaResponse = {
  distanciaKm: 12.4,
  tarifaFuente: 'ROAD',
  banda: 1,
  tarifa: 45000,
  fueraDeRango: false,
};

/** A free-form vitest mock: the TestBed useValue does not constrain it. */
type Stub = ReturnType<typeof vi.fn>;

function setup({
  otApi,
  clientesApi,
  sse,
}: {
  otApi?: { getOtById?: Stub };
  clientesApi?: { aprobarDiagnostico?: Stub; rechazarDiagnostico?: Stub };
  sse?: { abrirOtStream: ReturnType<typeof vi.fn> };
} = {}) {
  const getOtById = otApi?.getOtById ?? vi.fn(() => of(ot({})));
  const aprobarDiagnostico = clientesApi?.aprobarDiagnostico ?? vi.fn(() => of(undefined));
  const rechazarDiagnostico = clientesApi?.rechazarDiagnostico ?? vi.fn(() => of(undefined));

  const api = { getOtById };
  const clientes = { aprobarDiagnostico, rechazarDiagnostico };
  const sseMock = sse ?? { abrirOtStream: vi.fn(() => new Subject<OtEstadoCambiado>()) };
  const toast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [DiagnosticoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: api },
      { provide: ClientesApi, useValue: clientes },
      { provide: SseService, useValue: sseMock },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<DiagnosticoPage> = TestBed.createComponent(DiagnosticoPage);
  fixture.detectChanges();

  return { fixture, api, clientes, sseMock, toast, navigate };
}

function texto(fixture: ComponentFixture<DiagnosticoPage>): string {
  return fixture.nativeElement.textContent as string;
}

function click(fixture: ComponentFixture<DiagnosticoPage>, testid: string): void {
  const el = fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(el, `element ${testid} present`).not.toBeNull();
  el!.click();
  fixture.detectChanges();
}

function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('DiagnosticoPage móvil (A7)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    cambiarPestana('visible');
  });

  afterEach(() => {
    delete (document as { visibilityState?: string }).visibilityState;
    vi.useRealTimers();
  });

  it('carga la OT y pinta el dictamen con el chip de estado', () => {
    const { fixture, api } = setup({});

    expect(api.getOtById).toHaveBeenCalledWith('ot1');
    expect(texto(fixture)).toContain('OT-2026-0007');
    expect(texto(fixture)).toContain('Compresor con fuga de refrigerante');
    expect(fixture.nativeElement.querySelector('[data-testid="ot-estado"]')?.textContent).toContain(
      'En diagnóstico',
    );
  });

  it('sin diagnostico.diagnostico cae a fallaDetectada', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(ot({ diagnostico: { fallaDetectada: 'Fuga detectada en el circuito de baja.' } })),
        ),
      },
    });

    expect(texto(fixture)).toContain('Fuga detectada en el circuito de baja.');
    expect(texto(fixture)).not.toContain('Todavía no cargó el dictamen');
  });

  it('sin dictamen alguno muestra el texto honesto (nunca contenido inventado)', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ diagnostico: {} }))) },
    });

    expect(texto(fixture)).toContain('El técnico todavía no cargó el dictamen');
  });

  it('sin presupuesto las filas muestran "Por confirmar" y el aviso honesto', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() => of(ot({ presupuesto: undefined }))),
      },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="presupuesto-pendiente"]')).not.toBeNull();
    expect(texto(fixture)).toContain('El técnico todavía no cargó el presupuesto');
    expect(fixture.nativeElement.querySelector('[data-testid="costo-mano-obra"]')?.textContent).toContain(
      'Por confirmar',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="costo-repuestos"]')?.textContent).toContain(
      'Por confirmar',
    );
    expect(texto(fixture)).not.toContain('NaN');
  });

  it('con presupuesto muestra mano de obra, repuestos y total con formato es-CO', () => {
    const { fixture } = setup({});

    expect(fixture.nativeElement.querySelector('[data-testid="costo-mano-obra"]')?.textContent).toContain(
      '200.000',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="costo-repuestos"]')?.textContent).toContain(
      '150.000',
    );
    const total = fixture.nativeElement.querySelector('[data-testid="costo-total"]')?.textContent;
    expect(total).toContain('350.000');
    expect(total).toContain('COP');
  });

  it('manoDeObra (legacy) se usa cuando manoObra falta', () => {
    const presupuesto = {
      aprobado: false,
      total: 100000,
      manoObra: undefined as unknown as number,
      manoDeObra: 70000,
      repuestos: 30000,
    };
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ presupuesto }))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="costo-mano-obra"]')?.textContent).toContain(
      '70.000',
    );
  });

  it('el total suma la tarifa de visita cuando la estimación existe', () => {
    const { fixture } = setup({});
    const page = fixture.componentInstance;

    expect(page.totalServicio()).toBe(350000);

    page.estimacion.set(ESTIMACION);
    fixture.detectChanges();

    expect(page.totalServicio()).toBe(395000);
    const total = fixture.nativeElement.querySelector('[data-testid="costo-total"]')?.textContent;
    expect(total).toContain('395.000');
    expect(total).toContain('COP');
    expect(fixture.nativeElement.querySelector('[data-testid="costo-visita"]')?.textContent).toContain(
      '45.000',
    );
  });

  it('una carga fallida muestra el banner y Reintentar vuelve a pedir la OT', () => {
    const getOtById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValue(of(ot({})));
    const { fixture } = setup({ otApi: { getOtById } });

    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).not.toBeNull();

    click(fixture, 'ot-reintentar');

    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeNull();
    expect(texto(fixture)).toContain('OT-2026-0007');
  });

  it('un 403 se traduce a copy humano (nunca el string crudo del backend)', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          throwError(() => new ApiHttpError('orden 9 ajena a usuario 7', 403)),
        ),
      },
    });

    expect(texto(fixture)).toContain('permisos');
    expect(texto(fixture)).not.toContain('usuario 7');
  });

  it('un evento SSE recarga la OT', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot({})));
    setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({ otId: 'ot1', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' });

    expect(getOtById).toHaveBeenCalledTimes(2);
  });

  it('un SSE de otra OT no recarga esta pantalla', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot({})));
    setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({ otId: 'otra-ot', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' });

    expect(getOtById).toHaveBeenCalledTimes(1);
  });

  it('si el stream SSE se rinde, el poll de respaldo refresca cada 25 s', () => {
    vi.useFakeTimers();
    const getOtById = vi.fn(() => of(ot({})));
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

  it('aprobar llama a aprobarDiagnostico, avisa y vuelve a la OT', () => {
    const aprobarDiagnostico = vi.fn(() => of(undefined));
    const { fixture, toast, navigate } = setup({ clientesApi: { aprobarDiagnostico } });

    click(fixture, 'aprobar-presupuesto');

    expect(aprobarDiagnostico).toHaveBeenCalledWith('ot1');
    expect(toast.success).toHaveBeenCalledWith('Presupuesto aprobado', expect.any(String));
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('aprobar con error avisa con copy humano y NO navega', () => {
    const aprobarDiagnostico = vi.fn(() =>
      throwError(() => new ApiHttpError('violación de constraint presupuesto_chk del usuario 7', 500)),
    );
    const { fixture, toast, navigate } = setup({ clientesApi: { aprobarDiagnostico } });

    click(fixture, 'aprobar-presupuesto');

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo aprobar el presupuesto',
      expect.stringContaining('servidor'),
    );
    expect(String(toast.error.mock.calls[0]?.[1])).not.toContain('usuario 7');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rechazar exige al menos 5 caracteres antes de confirmar', () => {
    const rechazarDiagnostico = vi.fn(() => of(undefined));
    const { fixture } = setup({ clientesApi: { rechazarDiagnostico } });

    click(fixture, 'rechazar-presupuesto');
    const confirmar = fixture.nativeElement.querySelector(
      '[data-testid="rechazo-confirmar"]',
    ) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    const textarea = fixture.nativeElement.querySelector('#motivo-rechazo') as HTMLTextAreaElement;
    textarea.value = 'caro';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(true);
    expect(rechazarDiagnostico).not.toHaveBeenCalled();
  });

  it('rechazar con motivo válido avisa, cierra el panel y vuelve a la OT', () => {
    const rechazarDiagnostico = vi.fn(() => of(undefined));
    const { fixture, toast, navigate } = setup({ clientesApi: { rechazarDiagnostico } });

    click(fixture, 'rechazar-presupuesto');
    const textarea = fixture.nativeElement.querySelector('#motivo-rechazo') as HTMLTextAreaElement;
    textarea.value = 'No estoy de acuerdo con el costo';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click(fixture, 'rechazo-confirmar');

    expect(rechazarDiagnostico).toHaveBeenCalledWith('ot1', 'No estoy de acuerdo con el costo');
    expect(toast.warning).toHaveBeenCalledWith('Presupuesto rechazado', expect.any(String));
    expect(fixture.nativeElement.querySelector('[data-testid="panel-rechazo"]')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('rechazar con error avisa, conserva el texto y NO navega', () => {
    const rechazarDiagnostico = vi.fn(() =>
      throwError(() => new ApiHttpError('deadlock en ot_presupuesto del usuario 7', 500)),
    );
    const { fixture, toast, navigate } = setup({ clientesApi: { rechazarDiagnostico } });

    click(fixture, 'rechazar-presupuesto');
    const textarea = fixture.nativeElement.querySelector('#motivo-rechazo') as HTMLTextAreaElement;
    textarea.value = 'No estoy de acuerdo con el costo';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    click(fixture, 'rechazo-confirmar');

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo rechazar el presupuesto',
      expect.stringContaining('servidor'),
    );
    expect(String(toast.error.mock.calls[0]?.[1])).not.toContain('usuario 7');
    const textareaDespues = fixture.nativeElement.querySelector(
      '#motivo-rechazo',
    ) as HTMLTextAreaElement;
    expect(textareaDespues.value).toBe('No estoy de acuerdo con el costo');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-rechazo"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('fuera de EN_DIAGNOSTICO muestra el banner verde y ningún CTA de decisión', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => of(ot({ estado: 'FINALIZADA' }))) },
    });

    const banner = fixture.nativeElement.querySelector('[data-testid="presupuesto-gestionado"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Presupuesto gestionado con éxito');
    expect(banner?.textContent).toContain('Finalizada');
    expect(fixture.nativeElement.querySelector('[data-testid="decision-presupuesto"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="rechazar-presupuesto"]')).toBeNull();
  });

  it('conserva la nota legal de la visita y el diagnóstico', () => {
    const { fixture } = setup({});

    expect(texto(fixture)).toContain(
      'La visita y el diagnóstico se cobran según la distancia aunque no apruebes la reparación.',
    );
  });

  it('el banner de chat es "Próximamente" y no interactivo (sin inputs ni botones)', () => {
    const { fixture } = setup({});

    const chat = fixture.nativeElement.querySelector(
      '[data-testid="chat-proximamente"]',
    ) as HTMLElement;
    expect(chat).not.toBeNull();
    expect(chat.textContent).toContain('Próximamente');
    expect(chat.querySelector('input, textarea, button, a, ion-button')).toBeNull();
  });

  it('el CTA inferior vuelve al seguimiento de la OT', () => {
    const { fixture, navigate } = setup({});

    click(fixture, 'volver-ot');

    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });
});
