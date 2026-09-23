import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EjecucionOtPage } from './ejecucion-ot-page';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { TecnicoTrackingService } from '../infrastructure/tecnico-tracking.service';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { LiquidacionApi } from '../../liquidacion/infrastructure/liquidacion-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

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
    registrarDiagnostico: vi.fn(() => of(undefined)),
    finalizarServicio: vi.fn(() => of(undefined)),
  };
  const tracking = { ultimaPosicion: () => null, iniciar: vi.fn(), detener: vi.fn() };
  const otApi = { getOtById: vi.fn(() => of(opts.ot ?? orden())) };
  const liquidacionApi = { registrarPago: vi.fn(() => of(undefined)) };
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };

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
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(EjecucionOtPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, tracking, liquidacionApi, toast };
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

  it('registra la llegada a sitio', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.llegarADomicilio();
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
});
