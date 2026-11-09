import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtApi } from '@core/service/ot-api';
import { SseService, OtEstadoCambiado } from '@core/service/sse.service';
import { ActaGarantia, OtResponse, TarifaEstimadaResponse } from '@core/models/common.models';
import { POLL_INTERVAL_MS } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';
import { PagoActaPage } from './pago-acta.page';

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0009',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría y gotea agua.',
    direccion: 'Calle 15 # 3E-28',
    barrio: 'Caobos',
    estado: 'FINALIZADA',
    auxiliaresRequeridos: 0,
    tecnicoId: 'tec-1',
    tecnicoNombre: 'Carlos Pérez',
    punto: { latitud: 7.89, longitud: -72.5 },
    presupuesto: { aprobado: true, total: 350000, manoObra: 200000, repuestos: 150000 },
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

const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

/** Data URL the stub canvas exports; tests may blank it to force a failure. */
let dataUrlExportado = FIRMA;

/** Free-form vitest mock: the TestBed useValue does not constrain it. */
type Stub = ReturnType<typeof vi.fn>;

function setup({
  otApi,
  sse,
  orden = ot(),
}: {
  otApi?: { getOtById?: Stub; firmarActaGarantia?: Stub };
  sse?: { abrirOtStream: ReturnType<typeof vi.fn> };
  orden?: OtResponse;
} = {}) {
  const ctxStub = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxStub as unknown as CanvasRenderingContext2D,
  );
  const toDataURLSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(() => dataUrlExportado);

  const getOtById = otApi?.getOtById ?? vi.fn(() => of(orden));
  const firmarActaGarantia = otApi?.firmarActaGarantia ?? vi.fn(() => of(undefined));

  const api = { getOtById, firmarActaGarantia };
  const sseMock = sse ?? { abrirOtStream: vi.fn(() => new Subject<OtEstadoCambiado>()) };
  const toast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [PagoActaPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: api },
      { provide: SseService, useValue: sseMock },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<PagoActaPage> = TestBed.createComponent(PagoActaPage);
  fixture.detectChanges();

  return { fixture, api, sseMock, toast, navigate, ctxStub, toDataURLSpy };
}

function texto(fixture: ComponentFixture<PagoActaPage>): string {
  return fixture.nativeElement.textContent as string;
}

function click(fixture: ComponentFixture<PagoActaPage>, testid: string): void {
  const el = fixture.nativeElement.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(el, `element ${testid} present`).not.toBeNull();
  el!.click();
  fixture.detectChanges();
}

/** Deja la página con al menos un trazo dibujado en el canvas. */
function conFirma(fixture: ComponentFixture<PagoActaPage>): PagoActaPage {
  const page = fixture.componentInstance;
  page.startDrawing({ clientX: 10, clientY: 10 } as PointerEvent);
  page.draw({ clientX: 20, clientY: 20 } as PointerEvent);
  expect(page.hasFirma()).toBe(true);
  return page;
}

function botonActa(fixture: ComponentFixture<PagoActaPage>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('[data-testid="registrar-acta"]') as HTMLButtonElement;
}

function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('PagoActaPage móvil (A8)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    dataUrlExportado = FIRMA;
    cambiarPestana('visible');
  });

  afterEach(() => {
    delete (document as { visibilityState?: string }).visibilityState;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('carga la OT y pinta el desglose con montos en formato es-CO', () => {
    const { fixture, api } = setup({});

    expect(api.getOtById).toHaveBeenCalledWith('ot1');
    expect(texto(fixture)).toContain('OT-2026-0009');
    expect(
      fixture.nativeElement.querySelector('[data-testid="costo-mano-obra"]')?.textContent,
    ).toContain('200.000');
    expect(
      fixture.nativeElement.querySelector('[data-testid="costo-repuestos"]')?.textContent,
    ).toContain('150.000');
    const total = fixture.nativeElement.querySelector('[data-testid="costo-total"]')?.textContent;
    expect(total).toContain('350.000');
    expect(total).toContain('COP');
    // El split de comisión es información interna: no se muestra al cliente.
    expect(fixture.nativeElement.querySelector('[data-testid="comision-plataforma"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="liquido-tecnico"]')).toBeNull();
  });

  it('la visita nunca se consulta: la fila muestra "Por confirmar"', () => {
    const { fixture } = setup({});

    expect(fixture.nativeElement.querySelector('[data-testid="costo-visita"]')?.textContent).toContain(
      'Por confirmar',
    );
  });

  it('si la estimación existe, el total la incluye y no se expone el split interno', () => {
    const { fixture } = setup({});
    const page = fixture.componentInstance;

    page.estimacion.set(ESTIMACION);
    fixture.detectChanges();

    expect(page.totalMonto()).toBe(395000);
    expect(fixture.nativeElement.querySelector('[data-testid="costo-total"]')?.textContent).toContain(
      '395.000',
    );
    expect(texto(fixture)).not.toContain('Comisión');
    expect(texto(fixture)).not.toContain('líquido');
  });

  it('sin presupuesto las filas muestran "Por confirmar" y el aviso honesto', () => {
    const { fixture } = setup({ orden: ot({ presupuesto: undefined }) });

    expect(fixture.nativeElement.querySelector('[data-testid="presupuesto-pendiente"]')).not.toBeNull();
    expect(texto(fixture)).toContain('Sin presupuesto registrado');
    expect(fixture.nativeElement.querySelector('[data-testid="costo-mano-obra"]')?.textContent).toContain(
      'Por confirmar',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="costo-repuestos"]')?.textContent).toContain(
      'Por confirmar',
    );
    expect(texto(fixture)).not.toContain('NaN');
  });

  it('no renderiza ningún selector de medio de pago (ningún endpoint lo recibe)', () => {
    const { fixture } = setup({});

    expect(texto(fixture)).not.toContain('Medio de Pago');
    expect(texto(fixture)).not.toContain('Transferencia');
    expect(texto(fixture)).not.toContain('Efectivo');
  });

  it('muestra la cláusula legal con técnico, categoría, dirección y barrio', () => {
    const { fixture } = setup({});

    const clausula = fixture.nativeElement.querySelector(
      '[data-testid="acta-clausula"]',
    ) as HTMLElement;
    expect(clausula.textContent).toContain('ACTA DE CONFORMIDAD Y SERVICIO:');
    expect(clausula.textContent).toContain('el técnico Carlos Pérez');
    expect(clausula.textContent).toContain('AIRE ACONDICIONADO');
    expect(clausula.textContent).toContain('Calle 15 # 3E-28');
    expect(clausula.textContent).toContain('Caobos');
    expect(clausula.textContent).toContain('90 días calendario');
    expect(clausula.textContent).toContain('COLD DAY S.A.S.');
    expect(texto(fixture)).toContain('NIT 901.849.201-4');
  });

  it('una carga fallida muestra el banner y Reintentar vuelve a pedir la OT', () => {
    const getOtById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValue(of(ot()));
    const { fixture } = setup({ otApi: { getOtById } });

    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).not.toBeNull();

    click(fixture, 'ot-reintentar');

    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeNull();
    expect(texto(fixture)).toContain('OT-2026-0009');
  });

  it('un 403 en la carga se traduce a copy humano (nunca el string crudo)', () => {
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

  it('el CTA queda deshabilitado sin firma aunque la OT esté FINALIZADA', () => {
    const { fixture } = setup({});

    expect(botonActa(fixture).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="acta-no-finalizada"]')).toBeNull();
  });

  it('el CTA queda deshabilitado y el banner explica por qué si la OT no está FINALIZADA', () => {
    const { fixture } = setup({ orden: ot({ estado: 'EN_REPARACION' }) });
    conFirma(fixture);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="acta-no-finalizada"]');
    expect(banner?.textContent).toContain('El acta se registra al finalizar el servicio');
    expect(botonActa(fixture).disabled).toBe(true);
  });

  it('fuera de FINALIZADA registrarActa no llama al endpoint ni con firma', () => {
    const firmarActaGarantia = vi.fn(() => of(undefined));
    const { fixture } = setup({
      orden: ot({ estado: 'EN_CAMINO' }),
      otApi: { firmarActaGarantia },
    });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(firmarActaGarantia).not.toHaveBeenCalled();
  });

  it('al pasar a FINALIZADA (SSE) el CTA se habilita', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi
      .fn()
      .mockReturnValue(of(ot({ estado: 'EN_REPARACION' })))
      .mockReturnValueOnce(of(ot({ estado: 'EN_REPARACION' })));
    const { fixture } = setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });
    conFirma(fixture);
    expect(botonActa(fixture).disabled).toBe(true);

    getOtById.mockReturnValue(of(ot({ estado: 'FINALIZADA' })));
    stream.next({ otId: 'ot1', origen: 'EN_REPARACION', destino: 'FINALIZADA' });
    fixture.detectChanges();

    expect(botonActa(fixture).disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="acta-no-finalizada"]')).toBeNull();
  });

  it('la firma dibuja y Limpiar firma la borra', () => {
    const { fixture, ctxStub } = setup({});
    const page = fixture.componentInstance;

    page.startDrawing({ clientX: 10, clientY: 10 } as PointerEvent);
    page.draw({ clientX: 20, clientY: 20 } as PointerEvent);
    expect(page.hasFirma()).toBe(true);

    click(fixture, 'limpiar-firma');

    expect(page.hasFirma()).toBe(false);
    expect(ctxStub.clearRect).toHaveBeenCalled();
    expect(botonActa(fixture).disabled).toBe(true);
  });

  it('envía el dataURL exacto del canvas al endpoint del acta', () => {
    const firmarActaGarantia = vi.fn(() =>
      of<ActaGarantia>({
        otId: 'ot1',
        codigoVerificacion: 'CD-ACT-00000000000000AA',
        firmadaEn: '2026-11-04T15:00:00Z',
      }),
    );
    const { fixture } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);
    expect(firmarActaGarantia).toHaveBeenCalledWith('ot1', FIRMA);
  });

  it('el éxito muestra el código emitido por el servidor', () => {
    const acta: ActaGarantia = {
      otId: 'ot1',
      codigoVerificacion: 'CD-ACT-9F2A7C41B0D3E5A68',
      firmadaEn: '2026-11-04T15:00:00Z',
    };
    const { fixture, toast } = setup({ otApi: { firmarActaGarantia: vi.fn(() => of(acta)) } });
    const page = conFirma(fixture);

    page.registrarActa();
    fixture.detectChanges();

    expect(page.acta()).toEqual(acta);
    expect(toast.success).toHaveBeenCalledWith('Acta registrada', expect.stringContaining('CD-ACT-9F2A7C41B0D3E5A68'));
    expect(texto(fixture)).toContain('CD-ACT-9F2A7C41B0D3E5A68');
    expect(texto(fixture)).not.toContain('CD-SEC-');
  });

  it('un 409 se traduce al copy de ciclo de vida y conserva la firma dibujada', () => {
    const firmarActaGarantia = vi.fn(() =>
      throwError(() => new ApiHttpError('Solo se puede firmar el acta de una OT FINALIZADA, estado actual: EN_REPARACION.', 409)),
    );
    const { fixture, toast, ctxStub } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos registrar tu acta',
      'El acta ya quedó registrada o la orden no está finalizada todavía. Actualizá la pantalla para ver el estado actual.',
    );
    expect(String(toast.error.mock.calls[0]?.[1])).not.toContain('EN_REPARACION');
    expect(page.acta()).toBeNull();
    expect(page.hasFirma()).toBe(true);
    expect(ctxStub.clearRect).not.toHaveBeenCalled();
  });

  it('un 400 se traduce al copy de firma inválida', () => {
    const firmarActaGarantia = vi.fn(() =>
      throwError(() => new ApiHttpError('firma demasiado grande', 400)),
    );
    const { fixture, toast } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos registrar tu acta',
      'La firma no es válida: volvé a dibujarla y registrá el acta de nuevo.',
    );
  });

  it('un 403 se traduce al copy de orden ajena', () => {
    const firmarActaGarantia = vi.fn(() =>
      throwError(() => new ApiHttpError('orden 9 ajena a usuario 7', 403)),
    );
    const { fixture, toast } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos registrar tu acta',
      'Esta orden no te pertenece, así que no podés firmar su acta.',
    );
    expect(String(toast.error.mock.calls[0]?.[1])).not.toContain('usuario 7');
  });

  it('tras un fallo la CTA vuelve a quedar habilitada (el error no traba la pantalla)', () => {
    const firmarActaGarantia = vi.fn(() =>
      throwError(() => new ApiHttpError('boom', 500)),
    );
    const { fixture } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();
    fixture.detectChanges();

    expect(page.guardando()).toBe(false);
    expect(botonActa(fixture).disabled).toBe(false);
  });

  it('un 2xx sin código se trata como fallo, no como acta registrada', () => {
    const firmarActaGarantia = vi.fn(() => of(undefined as unknown as ActaGarantia));
    const { fixture, toast } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(page.acta()).toBeNull();
  });

  it('bloquea el doble envío mientras la petición está en vuelo', () => {
    const enVuelo = new Subject<ActaGarantia>();
    const firmarActaGarantia = vi.fn(() => enVuelo.asObservable());
    const { fixture } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();
    expect(page.guardando()).toBe(true);

    page.registrarActa();
    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);

    enVuelo.next({
      otId: 'ot1',
      codigoVerificacion: 'CD-ACT-1111222233334444',
      firmadaEn: '2026-11-04T15:00:00Z',
    });
    enVuelo.complete();

    expect(page.guardando()).toBe(false);
    expect(page.acta()?.codigoVerificacion).toBe('CD-ACT-1111222233334444');
  });

  it('un acta ya registrada no se vuelve a firmar', () => {
    const acta: ActaGarantia = {
      otId: 'ot1',
      codigoVerificacion: 'CD-ACT-AAAAAAAABBBBBBBB',
      firmadaEn: '2026-11-04T15:00:00Z',
    };
    const firmarActaGarantia = vi.fn(() => of(acta));
    const { fixture } = setup({ otApi: { firmarActaGarantia } });
    const page = conFirma(fixture);

    page.registrarActa();
    page.registrarActa();

    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);
    expect(botonActa(fixture).disabled).toBe(true);
  });

  it('si el canvas no se puede exportar, el endpoint no se llama y se avisa', () => {
    const firmarActaGarantia = vi.fn(() =>
      of<ActaGarantia>({
        otId: 'ot1',
        codigoVerificacion: 'CD-ACT-00000000000000BB',
        firmadaEn: '2026-11-04T15:00:00Z',
      }),
    );
    const { fixture, toast } = setup({ otApi: { firmarActaGarantia } });
    dataUrlExportado = '';
    const page = conFirma(fixture);

    page.registrarActa();

    expect(firmarActaGarantia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('si toDataURL lanza (canvas contaminado), el endpoint no se llama y se avisa', () => {
    const firmarActaGarantia = vi.fn(() =>
      of<ActaGarantia>({
        otId: 'ot1',
        codigoVerificacion: 'CD-ACT-00000000000000CC',
        firmadaEn: '2026-11-04T15:00:00Z',
      }),
    );
    const { fixture, toast, toDataURLSpy } = setup({ otApi: { firmarActaGarantia } });
    toDataURLSpy.mockImplementation(() => {
      throw new DOMException('tainted', 'SecurityError');
    });
    const page = conFirma(fixture);

    page.registrarActa();

    expect(firmarActaGarantia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(page.acta()).toBeNull();
  });

  it('un evento SSE recarga la OT; uno de otra OT no', () => {
    const stream = new Subject<OtEstadoCambiado>();
    const getOtById = vi.fn(() => of(ot()));
    setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => stream.asObservable()) },
    });

    stream.next({ otId: 'otra-ot', origen: 'EN_REPARACION', destino: 'FINALIZADA' });
    expect(getOtById).toHaveBeenCalledTimes(1);

    stream.next({ otId: 'ot1', origen: 'EN_REPARACION', destino: 'FINALIZADA' });
    expect(getOtById).toHaveBeenCalledTimes(2);
  });

  it('si el stream SSE se rinde, el poll de respaldo refresca cada 25 s', () => {
    vi.useFakeTimers();
    const getOtById = vi.fn(() => of(ot()));
    setup({
      otApi: { getOtById },
      sse: { abrirOtStream: vi.fn(() => throwError(() => new Error('stream caído'))) },
    });

    expect(getOtById).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(getOtById).toHaveBeenCalledTimes(2);
  });

  it('muestra la nota de visita pendiente de pago en una OT ASIGNADA sin pago', () => {
    const { fixture } = setup({
      orden: ot({ estado: 'ASIGNADA', visitaPagada: false }),
    });

    expect(texto(fixture)).toContain('Visita pendiente de pago');
  });

  it('muestra la nota de visita pagada cuando el backend la reporta', () => {
    const { fixture } = setup({
      orden: ot({ estado: 'ASIGNADA', visitaPagada: true }),
    });

    expect(texto(fixture)).toContain('Visita pagada');
  });

  it('el CTA inferior vuelve al seguimiento de la OT', () => {
    const { fixture, navigate } = setup({});

    click(fixture, 'volver-ot');

    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });
});
