import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { EjecucionOtPage } from './ejecucion-ot-page';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { MapsApi } from '../../core/service/maps-api';
import { OtApi } from '../../core/service/ot-api';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { OtResponse } from '../../core/models/common.models';

function orden(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
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
});
