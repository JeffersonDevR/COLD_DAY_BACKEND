import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LiquidacionesTecnicoPage } from './liquidaciones-tecnico-page';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { LiquidacionApi } from '../../liquidacion/infrastructure/liquidacion-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { LiquidacionResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';

function liquidacion(overrides: Partial<LiquidacionResponse>): LiquidacionResponse {
  return {
    id: 'L1',
    otId: 'OT-1',
    tecnicoId: 'TEC-1',
    montoServicio: 100000,
    comision: 15000,
    estado: 'PENDIENTE_CONSIGNACION',
    medioPago: 'EFECTIVO',
    ...overrides,
  };
}

function setup(opts: { tecnico?: TecnicoResponse; liquidaciones?: LiquidacionResponse[] } = {}) {
  const tecnicosApi = {
    getTecnicoPorUsuarioId: vi.fn(() => of(opts.tecnico ?? { id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' })),
  };
  const liquidacionApi = {
    getLiquidacionesPorTecnico: vi.fn(() => of(opts.liquidaciones ?? [liquidacion({}), liquidacion({ id: 'L2', estado: 'APROBADA', comision: 5000 })])),
    subirComprobante: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    imports: [LiquidacionesTecnicoPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(LiquidacionesTecnicoPage);
  fixture.detectChanges();
  return { fixture, liquidacionApi, toast };
}

describe('LiquidacionesTecnicoPage', () => {
  it('calcula deuda total y total recaudado', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.deudaTotal()).toBe(15000);
    expect(fixture.componentInstance.totalRecaudado()).toBe(200000);
  });

  it('marca bloqueado cuando hay deuda pendiente', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.estaBloqueado()).toBe(true);
  });

  it('abre el formulario de comprobante', () => {
    const { fixture } = setup();
    fixture.componentInstance.abrirSubida(liquidacion({}));
    expect(fixture.componentInstance.liqSeleccionada()?.id).toBe('L1');
  });

  it('envía el comprobante y recarga', () => {
    const { fixture, liquidacionApi, toast } = setup();
    fixture.componentInstance.abrirSubida(liquidacion({}));

    fixture.componentInstance.enviarComprobante();

    expect(liquidacionApi.subirComprobante).toHaveBeenCalledWith(
      'L1',
      'https://coldday.com.co/recibos/consignacion-bancolombia.jpg',
      'BCOL-8492048',
    );
    expect(toast.success).toHaveBeenCalled();
    expect(fixture.componentInstance.liqSeleccionada()).toBeNull();
  });

  it('no envía sin comprobante seleccionado', () => {
    const { fixture, liquidacionApi } = setup();
    fixture.componentInstance.enviarComprobante();
    expect(liquidacionApi.subirComprobante).not.toHaveBeenCalled();
  });

  it('copia los datos bancarios', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.copiarDatosBanco();
    expect(toast.info).toHaveBeenCalledWith('Copiado', expect.any(String));
  });
});
