import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ConsignacionesAdminPage } from './consignaciones-admin-page';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { LiquidacionResponse, TecnicoResponse } from '../../core/models/common.models';

function liquidacion(overrides: Partial<LiquidacionResponse>): LiquidacionResponse {
  return {
    id: 'L1',
    otId: 'OT-1',
    tecnicoId: 'TEC-1',
    tecnicoNombre: 'Juan',
    montoServicio: 100000,
    comision: 15000,
    estado: 'EN_VERIFICACION',
    medioPago: 'EFECTIVO',
    ...overrides,
  };
}

function setup() {
  const liquidacionApi = {
    getTodasLiquidaciones: vi.fn(() =>
      of([
        liquidacion({ id: 'L1', estado: 'EN_VERIFICACION' }),
        liquidacion({ id: 'L2', estado: 'APROBADA', comision: 5000 }),
      ]),
    ),
    aprobarLiquidacion: vi.fn(() => of(undefined)),
    rechazarLiquidacion: vi.fn(() => of(undefined)),
  };
  const tecnicosApi = {
    getTecnicos: vi.fn(() =>
      of<TecnicoResponse[]>([
        { id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'BLOQUEADO_POR_LIQUIDACION' },
        { id: 'TEC-2', nombre: 'Ana', correo: 'a@x.co', estadoOperativo: 'DISPONIBLE' },
      ]),
    ),
  };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ConsignacionesAdminPage],
    providers: [
      provideRouter([]),
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(ConsignacionesAdminPage);
  fixture.detectChanges();
  return { fixture, liquidacionApi, toast };
}

describe('ConsignacionesAdminPage', () => {
  it('calcula los resúmenes de conciliación', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.enVerificacion().length).toBe(1);
    expect(fixture.componentInstance.tecnicosBloqueados().length).toBe(1);
    expect(fixture.componentInstance.totalComisionesAprobadas()).toBe(5000);
  });

  it('aprueba una liquidación y avisa', () => {
    const { fixture, liquidacionApi, toast } = setup();
    fixture.componentInstance.aprobar(liquidacion({ id: 'L1' }));
    expect(liquidacionApi.aprobarLiquidacion).toHaveBeenCalledWith('L1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('rechaza con motivo válido', () => {
    const { fixture, liquidacionApi, toast } = setup();
    fixture.componentInstance.abrirRechazo(liquidacion({ id: 'L1' }));
    fixture.componentInstance.motivoCtrl.setValue('valor no coincide');

    fixture.componentInstance.confirmarRechazo();

    expect(liquidacionApi.rechazarLiquidacion).toHaveBeenCalledWith('L1', 'valor no coincide');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.liqARechazar()).toBeNull();
  });

  it('no rechaza sin motivo válido', () => {
    const { fixture, liquidacionApi } = setup();
    fixture.componentInstance.abrirRechazo(liquidacion({ id: 'L1' }));
    fixture.componentInstance.motivoCtrl.setValue('x');

    fixture.componentInstance.confirmarRechazo();

    expect(liquidacionApi.rechazarLiquidacion).not.toHaveBeenCalled();
  });

  it('avisa si falla la aprobación de la conciliación y no recarga', () => {
    const { fixture, liquidacionApi, toast } = setup();
    liquidacionApi.aprobarLiquidacion.mockReturnValue(
      throwError(() => new ApiHttpError('La liquidación no está en verificación', 409)),
    );

    fixture.componentInstance.aprobar(liquidacion({ id: 'L1' }));

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo aprobar la conciliación', expect.any(String));
    // Solo la carga inicial: el fallo no dispara refetch.
    expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(1);
  });

  it('avisa si falla el rechazo y mantiene el modal con el motivo', () => {
    const { fixture, liquidacionApi, toast } = setup();
    liquidacionApi.rechazarLiquidacion.mockReturnValue(
      throwError(() => new ApiHttpError('La liquidación ya no está pendiente', 409)),
    );
    fixture.componentInstance.abrirRechazo(liquidacion({ id: 'L1' }));
    fixture.componentInstance.motivoCtrl.setValue('valor no coincide');

    fixture.componentInstance.confirmarRechazo();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo rechazar la liquidación', expect.any(String));
    expect(fixture.componentInstance.liqARechazar()).not.toBeNull();
    expect(fixture.componentInstance.motivoCtrl.value).toBe('valor no coincide');
    expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(1);
  });
});
