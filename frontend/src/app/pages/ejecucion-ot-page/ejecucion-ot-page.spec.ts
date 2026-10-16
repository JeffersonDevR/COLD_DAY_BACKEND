import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { EjecucionOtPage } from './ejecucion-ot-page';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { MapsApi } from '../../core/service/maps-api';
import { OtApi } from '../../core/service/ot-api';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OtResponse } from '../../core/models/common.models';

function orden(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0002',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'EN_REPARACION',
    auxiliaresRequeridos: 0,
    clienteNombre: 'Ana',
    direccion: 'calle 1',
    punto: { latitud: 7.88, longitud: -72.49 },
    presupuesto: { aprobado: true, total: 150000, manoObra: 90000, repuestos: 60000 },
    ...overrides,
  };
}

function setup(opts: { useMocks?: boolean; ot?: OtResponse } = {}) {
  const tecnicosApi = {
    iniciarDesplazamiento: vi.fn(() => of(undefined)),
    llegarADomicilio: vi.fn(() => of(undefined)),
    registrarDiagnostico: vi.fn(() => of(undefined)),
    finalizarServicio: vi.fn(() => of(undefined)),
  };
  const tracking = { ultimaPosicion: () => null, iniciar: vi.fn(), detener: vi.fn() };
  const otApi = { getOtById: vi.fn(() => of(opts.ot ?? orden())) };
  const liquidacionApi = { registrarPago: vi.fn(() => of(undefined)) };
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const sseEventos = new Subject<OtEstadoCambiado>();
  const sse = { abrirOtStream: vi.fn(() => sseEventos.asObservable()) };

  TestBed.configureTestingModule({
    imports: [EjecucionOtPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: MockDbService, useValue: { ordenesTrabajo: () => [opts.ot ?? orden()] } },
      { provide: ApiConfig, useValue: { useMocks: () => opts.useMocks ?? false } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: TecnicoTrackingService, useValue: tracking },
      { provide: MapsApi, useValue: { distancia: () => of({ distanciaKm: 1, duracionMin: 3 }) } },
      { provide: OtApi, useValue: otApi },
      { provide: SseService, useValue: sse },
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(EjecucionOtPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, tracking, liquidacionApi, toast, otApi, sse, sseEventos };
}

describe('EjecucionOtPage', () => {
  it('carga la OT e inicia el tracking', () => {
    const { fixture, tracking } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(tracking.iniciar).toHaveBeenCalled();
  });

  it('inicia el desplazamiento', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.iniciarDesplazamiento();
    expect(tecnicosApi.iniciarDesplazamiento).toHaveBeenCalledWith('ot1');
    expect(toast.info).toHaveBeenCalled();
  });

  it('bloquea el desplazamiento cuando la visita no está pagada (WS5)', () => {
    const { fixture, tecnicosApi, toast } = setup({
      ot: orden({ estado: 'ASIGNADA', visitaPagada: false }),
    });

    expect(fixture.componentInstance.desplazamientoBloqueadoPorPago()).toBe(true);

    fixture.componentInstance.iniciarDesplazamiento();

    expect(tecnicosApi.iniciarDesplazamiento).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Visita pendiente de pago', expect.any(String));
  });

  it('permite el desplazamiento cuando la visita está pagada (WS5)', () => {
    const { fixture, tecnicosApi } = setup({
      ot: orden({ estado: 'ASIGNADA', visitaPagada: true }),
    });

    expect(fixture.componentInstance.desplazamientoBloqueadoPorPago()).toBe(false);

    fixture.componentInstance.iniciarDesplazamiento();

    expect(tecnicosApi.iniciarDesplazamiento).toHaveBeenCalledWith('ot1');
  });

  it('no bloquea si el backend no reporta el estado de pago (mock/legacy)', () => {
    const { fixture } = setup({ ot: orden({ estado: 'ASIGNADA' }) });

    expect(fixture.componentInstance.desplazamientoBloqueadoPorPago()).toBe(false);
  });

  it('registra la llegada a sitio', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.llegarADomicilio();
    expect(tecnicosApi.llegarADomicilio).toHaveBeenCalledWith('ot1');
    expect(fixture.componentInstance.enSitio()).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it('envía el diagnóstico', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.enviarDiagnostico();
    expect(tecnicosApi.registrarDiagnostico).toHaveBeenCalledWith(
      'ot1',
      expect.objectContaining({ manoDeObra: 80000, repuestos: 70000 }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('finaliza el servicio y registra el pago', () => {
    const { fixture, tecnicosApi, tracking, liquidacionApi, toast } = setup();
    fixture.componentInstance.finalizarServicio();

    expect(tecnicosApi.finalizarServicio).toHaveBeenCalledWith('ot1', 'EFECTIVO');
    expect(tracking.detener).toHaveBeenCalled();
    expect(liquidacionApi.registrarPago).toHaveBeenCalledWith('ot1', 150000, 'EFECTIVO');
    expect(toast.success).toHaveBeenCalled();
  });

  it('en modo mock no duplica la liquidación', () => {
    const { fixture, liquidacionApi, toast } = setup({ useMocks: true });
    fixture.componentInstance.finalizarServicio();
    expect(liquidacionApi.registrarPago).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('avisa si la OT no tiene monto de presupuesto', () => {
    const { fixture, liquidacionApi, toast } = setup({ ot: orden({ presupuesto: undefined }) });
    fixture.componentInstance.finalizarServicio();
    expect(liquidacionApi.registrarPago).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Servicio Completado', expect.any(String));
  });

  it('detiene el tracking al destruir', () => {
    const { fixture, tracking } = setup();
    fixture.destroy();
    expect(tracking.detener).toHaveBeenCalled();
  });

  it('abre el stream de cambios de estado de la OT cargada', () => {
    const { sse } = setup();
    expect(sse.abrirOtStream).toHaveBeenCalledWith('ot1');
  });

  it('recarga la OT al recibir un cambio de estado de la misma orden', () => {
    const { otApi, sseEventos } = setup();
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);

    sseEventos.next({ otId: 'ot1', origen: 'ASIGNADA', destino: 'EN_CAMINO' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
  });

  it('ignora un cambio de estado de otra orden', () => {
    const { otApi, sseEventos } = setup();

    sseEventos.next({ otId: 'ot-ajena', origen: 'SOLICITADA', destino: 'ASIGNADA' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('corta el stream al destruir la página (sin fugas)', () => {
    const { fixture, otApi, sseEventos } = setup();
    expect(sseEventos.observed).toBe(true);

    fixture.destroy();

    expect(sseEventos.observed).toBe(false);
    sseEventos.next({ otId: 'ot1', origen: 'ASIGNADA', destino: 'EN_CAMINO' });
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('avisa si falla el inicio del desplazamiento y no recarga la OT (409 visita sin pagar)', () => {
    const { fixture, tecnicosApi, otApi, toast } = setup({ ot: orden({ estado: 'ASIGNADA' }) });
    tecnicosApi.iniciarDesplazamiento.mockReturnValue(
      throwError(() => new ApiHttpError('La visita debe estar pagada antes de iniciar el desplazamiento', 409)),
    );

    fixture.componentInstance.iniciarDesplazamiento();

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo iniciar el desplazamiento',
      'No se pudo iniciar el desplazamiento: el cliente puede no haber pagado la visita todavía, o la orden pudo cambiar de estado en otro dispositivo. Actualiza la página e inténtalo de nuevo.',
    );
    // Solo la carga inicial: el fallo no dispara refetch.
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('avisa si falla la finalización y no registra el pago', () => {
    const { fixture, tecnicosApi, tracking, liquidacionApi, toast } = setup();
    tecnicosApi.finalizarServicio.mockReturnValue(
      throwError(() => new ApiHttpError('Solo se puede finalizar en EN_REPARACION', 409)),
    );

    fixture.componentInstance.finalizarServicio();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo finalizar el servicio', expect.any(String));
    // El fallo no detiene el tracking ni dispara el registro del pago.
    expect(tracking.detener).not.toHaveBeenCalled();
    expect(liquidacionApi.registrarPago).not.toHaveBeenCalled();
  });

  it('identifica la ejecución por el código de la OT, no por el id interno', () => {
    // El `id` es el UUID interno del backend: la cabecera del técnico no lo muestra.
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const { fixture } = setup({ ot: orden({ id: idInterno, codigo: 'OT-2026-0017' }) });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ejecución OT: OT-2026-0017');
    expect(texto).not.toContain(idInterno);
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
      const { otApi, sseEventos } = setup();
      expect(otApi.getOtById).toHaveBeenCalledTimes(1);

      sseEventos.error(new Error('stream agotado'));
      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    });

    it('no pollea mientras el stream sigue vivo', () => {
      const { otApi } = setup();

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(otApi.getOtById).toHaveBeenCalledTimes(1);
    });

    it('detiene el poll de respaldo al destruirse el componente', () => {
      const { fixture, otApi, sseEventos } = setup();
      sseEventos.error(new Error('stream agotado'));
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      expect(otApi.getOtById).toHaveBeenCalledTimes(2);

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    });
  });

});
