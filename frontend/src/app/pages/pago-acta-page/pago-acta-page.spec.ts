import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PagoActaPage } from './pago-acta-page';
import { OtApi } from '../../core/service/ot-api';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { ActaGarantia, OtResponse } from '../../core/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  codigo: 'OT-2026-0009',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'x',
  estado: 'FINALIZADA',
  auxiliaresRequeridos: 0,
  tecnicoNombre: 'Juan',
  punto: { latitud: 7.89, longitud: -72.5 },
  presupuesto: { aprobado: true, total: 150000, manoObra: 90000, repuestos: 60000 },
};

const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

/** Data URL que exporta el canvas simulado. */
let dataUrlExportado = FIRMA;

function setup(firmarActaGarantia: ReturnType<typeof vi.fn>, ordenRespuesta: OtResponse = orden) {
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
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    () => dataUrlExportado,
  );
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const estimacion = {
    distanciaKm: 9.5,
    tarifaFuente: 'LINEAL' as const,
    banda: 1,
    tarifa: 35000,
    fueraDeRango: false,
  };
  const otApi = {
    getOtById: vi.fn(() => of(ordenRespuesta)),
    estimarTarifa: vi.fn(() => of(estimacion)),
    firmarActaGarantia,
  };
  const sseEventos = new Subject<OtEstadoCambiado>();
  const sse = { abrirOtStream: vi.fn(() => sseEventos.asObservable()) };
  TestBed.configureTestingModule({
    imports: [PagoActaPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: otApi },
      { provide: SseService, useValue: sse },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(PagoActaPage);
  fixture.detectChanges();
  return { fixture, toast, ctxStub, otApi, sse, sseEventos };
}

/** Deja el componente en el estado previo a firmar: hubo trazo en el canvas. */
function conFirma(fixture: ReturnType<typeof setup>['fixture']) {
  const page = fixture.componentInstance;
  page.startDrawing({ clientX: 10, clientY: 10 } as MouseEvent);
  page.draw({ clientX: 20, clientY: 20 } as MouseEvent);
  expect(page.hasFirma()).toBe(true);
  return page;
}

beforeEach(() => {
  dataUrlExportado = FIRMA;
});

describe('PagoActaPage', () => {
  it('carga la OT y calcula el total a pagar', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)));
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(fixture.componentInstance.totalMonto()).toBe(185000);
  });

  it('registra la firma al dibujar y la limpia', () => {
    const { fixture, ctxStub } = setup(vi.fn(() => of(undefined)));
    const page = fixture.componentInstance;

    page.startDrawing({ clientX: 10, clientY: 10 } as MouseEvent);
    page.draw({ clientX: 20, clientY: 20 } as MouseEvent);
    expect(page.hasFirma()).toBe(true);

    page.limpiarFirma();
    expect(page.hasFirma()).toBe(false);
    expect(ctxStub.clearRect).toHaveBeenCalled();
  });

  it('permite elegir el medio de pago', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)));
    fixture.componentInstance.medioPago.set('TRANSFERENCIA');
    expect(fixture.componentInstance.medioPago()).toBe('TRANSFERENCIA');
  });

  it('refleja la visita pagada cuando el backend la reporta (WS5)', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)), {
      ...orden,
      estado: 'ASIGNADA',
      visitaPagada: true,
    });

    expect(fixture.componentInstance.visitaPagada()).toBe(true);
    expect(fixture.componentInstance.visitaPendienteDePago()).toBe(false);
  });

  it('marca la visita como pendiente de pago en una OT ASIGNADA sin pago (WS5)', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)), {
      ...orden,
      estado: 'ASIGNADA',
      visitaPagada: false,
    });

    expect(fixture.componentInstance.visitaPagada()).toBe(false);
    expect(fixture.componentInstance.visitaPendienteDePago()).toBe(true);
  });

  it('no muestra ningún código de verificación antes de firmar', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)));
    // El código se armaba en el template como `CD-SEC-{{ orden.id }}`. Sin
    // una respuesta del servidor no hay nada que verificar, y una cadena
    // fabricada se lee igual que una real.
    expect(fixture.componentInstance.acta()).toBeNull();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('CD-SEC-ot1');
    expect(texto).not.toContain('Código de verificación: CD-SEC');
  });

  it('envía la firma del canvas al endpoint del acta', () => {
    const firmarActaGarantia = vi.fn(() =>
      of<ActaGarantia>({ otId: 'ot1', codigoVerificacion: 'CD-ACT-00000000000000AA', firmadaEn: '2026-10-05T15:00:00Z' }),
    );
    const { fixture } = setup(firmarActaGarantia);
    const page = conFirma(fixture);

    page.guardarYDescargarActa();

    // La firma dibujada es la que viaja: antes se descartaba al hacer clic.
    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);
    expect(firmarActaGarantia).toHaveBeenCalledWith('ot1', FIRMA);
  });

  it('confirma con el código emitido por el servidor y no solo con un toast', () => {
    const acta: ActaGarantia = {
      otId: 'ot1',
      codigoVerificacion: 'CD-ACT-9F2A7C41B0D3E5A68',
      firmadaEn: '2026-10-05T15:00:00Z',
    };
    const { fixture, toast } = setup(vi.fn(() => of(acta)));
    const page = conFirma(fixture);

    page.guardarYDescargarActa();

    expect(page.acta()).toEqual(acta);
    expect(toast.success).toHaveBeenCalledWith('Acta registrada', expect.stringContaining('CD-ACT-9F2A7C41B0D3E5A68'));
    expect(toast.error).not.toHaveBeenCalled();

    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('CD-ACT-9F2A7C41B0D3E5A68');
  });

  it('NO anuncia el acta si el servidor la rechaza', () => {
    // 409 real del backend: OT no FINALIZADA o acta ya firmada.
    const firmarActaGarantia = vi.fn(() =>
      throwError(() => new ApiHttpError('Solo se puede firmar el acta de una OT FINALIZADA, estado actual: EN_CAMINO.', 409)),
    );
    const { fixture, toast } = setup(firmarActaGarantia);
    const page = conFirma(fixture);

    page.guardarYDescargarActa();

    // El copy del 409 nombra el conflicto del ciclo de vida sin repetir el
    // mensaje crudo del servidor; lo importante es que NO es un "éxito".
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos registrar tu acta',
      'La orden ya no admite registrar el acta de garantía: puede estar ya registrada o no estar finalizada todavía. Actualizá la página para ver el estado actual.',
    );
    expect(page.acta()).toBeNull();
  });

  it('no muestra código alguno cuando la petición falla', () => {
    const { fixture } = setup(vi.fn(() => throwError(() => new Error('conflicto'))));
    const page = conFirma(fixture);

    page.guardarYDescargarActa();
    fixture.detectChanges();

    expect(page.acta()).toBeNull();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Código de verificación: CD-ACT');
  });

  it('bloquea el botón mientras la petición está en vuelo y evita el doble envío', () => {
    const enVuelo = new Subject<ActaGarantia>();
    const firmarActaGarantia = vi.fn(() => enVuelo.asObservable());
    const { fixture } = setup(firmarActaGarantia);
    const page = conFirma(fixture);

    page.guardarYDescargarActa();
    expect(page.guardando()).toBe(true);

    // Un segundo clic con la petición abierta llegaría al backend como un
    // intento de segunda firma, que responde 409.
    page.guardarYDescargarActa();
    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);

    enVuelo.next({ otId: 'ot1', codigoVerificacion: 'CD-ACT-1111222233334444', firmadaEn: '2026-10-05T15:00:00Z' });
    enVuelo.complete();

    expect(page.guardando()).toBe(false);
    expect(page.acta()?.codigoVerificacion).toBe('CD-ACT-1111222233334444');
  });

  it('trata un 2xx sin código como fallo, no como acta generada', () => {
    const firmarActaGarantia = vi.fn(() => of(undefined as unknown as ActaGarantia));
    const { fixture, toast } = setup(firmarActaGarantia);
    const page = conFirma(fixture);

    page.guardarYDescargarActa();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(page.acta()).toBeNull();
  });

  it('no vuelve a firmar un acta ya registrada', () => {
    const acta: ActaGarantia = {
      otId: 'ot1',
      codigoVerificacion: 'CD-ACT-AAAAAAAABBBBBBBB',
      firmadaEn: '2026-10-05T15:00:00Z',
    };
    const firmarActaGarantia = vi.fn(() => of(acta));
    const { fixture } = setup(firmarActaGarantia);
    const page = conFirma(fixture);

    page.guardarYDescargarActa();
    page.guardarYDescargarActa();

    expect(firmarActaGarantia).toHaveBeenCalledTimes(1);
  });

  it('reporta el fallo si el canvas no se puede exportar', () => {
    const firmarActaGarantia = vi.fn(() =>
      of<ActaGarantia>({ otId: 'ot1', codigoVerificacion: 'CD-ACT-00000000000000BB', firmadaEn: '2026-10-05T15:00:00Z' }),
    );
    const { fixture, toast } = setup(firmarActaGarantia);
    dataUrlExportado = '';
    const page = conFirma(fixture);

    page.guardarYDescargarActa();

    expect(firmarActaGarantia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('abre el stream de cambios de estado de la OT cargada', () => {
    const { sse } = setup(vi.fn(() => of(undefined)));
    expect(sse.abrirOtStream).toHaveBeenCalledWith('ot1');
  });

  it('recarga la OT y su estimación al recibir un cambio de estado de la misma orden', () => {
    const { otApi, sseEventos } = setup(vi.fn(() => of(undefined)));
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
    expect(otApi.estimarTarifa).toHaveBeenCalledTimes(1);

    sseEventos.next({ otId: 'ot1', origen: 'EN_REPARACION', destino: 'FINALIZADA' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    expect(otApi.estimarTarifa).toHaveBeenCalledTimes(2);
  });

  it('ignora un cambio de estado de otra orden', () => {
    const { otApi, sseEventos } = setup(vi.fn(() => of(undefined)));

    sseEventos.next({ otId: 'ot-ajena', origen: 'SOLICITADA', destino: 'ASIGNADA' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('corta el stream al destruir la página (sin fugas)', () => {
    const { fixture, otApi, sseEventos } = setup(vi.fn(() => of(undefined)));
    expect(sseEventos.observed).toBe(true);

    fixture.destroy();

    expect(sseEventos.observed).toBe(false);
    sseEventos.next({ otId: 'ot1', origen: 'EN_REPARACION', destino: 'FINALIZADA' });
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('encabeza el acta con el código de la OT y no con el id interno', () => {
    // El `id` es el UUID interno del backend: el documento no debe mostrarlo.
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const { fixture } = setup(vi.fn(() => of(undefined)), { ...orden, id: idInterno, codigo: 'OT-2026-0018' });
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('OT: OT-2026-0018');
    expect(texto).not.toContain(idInterno);
  });

  describe('nombre del técnico en el acta', () => {
    it('certifica el nombre real del técnico', () => {
      const { fixture } = setup(vi.fn(() => of(undefined)));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('el técnico Juan');
    });

    it('sin nombre del técnico usa un rótulo neutro coherente con la frase', () => {
      // La frase certifica que el servicio YA se ejecutó: "por asignar" la
      // contradecía; "a cargo" describe el mismo hecho sin afirmar la asignación.
      const { fixture } = setup(vi.fn(() => of(undefined)), { ...orden, tecnicoNombre: undefined });
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('el técnico a cargo ha ejecutado');
      expect(texto).not.toContain('el técnico Asignado');
      expect(texto).not.toContain('por asignar');
    });
  });

  describe('poll de respaldo cuando el stream SSE se rinde', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('arranca el poll y refresca la OT cuando el stream se cae', () => {
      const { otApi, sseEventos } = setup(vi.fn());
      expect(otApi.getOtById).toHaveBeenCalledTimes(1);

      sseEventos.error(new Error('stream agotado'));
      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    });

    it('no pollea mientras el stream sigue vivo', () => {
      const { otApi } = setup(vi.fn());

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(otApi.getOtById).toHaveBeenCalledTimes(1);
    });

    it('detiene el poll de respaldo al destruirse el componente', () => {
      const { fixture, otApi, sseEventos } = setup(vi.fn());
      sseEventos.error(new Error('stream agotado'));
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      expect(otApi.getOtById).toHaveBeenCalledTimes(2);

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    });
  });

});
