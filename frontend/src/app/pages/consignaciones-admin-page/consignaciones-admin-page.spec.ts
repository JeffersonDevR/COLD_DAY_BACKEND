import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ConsignacionesAdminPage } from './consignaciones-admin-page';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ESPERA_RECARGA_ADMIN_MS } from '../../core/service/admin-actividad-refresco';
import { AdminActividad, SseService } from '../../core/service/sse.service';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { LiquidacionResponse, TecnicoResponse } from '../../core/models/common.models';

interface CanalAdmin {
  abrirAdminStream: ReturnType<typeof vi.fn>;
}

function actividad(tipo: AdminActividad['tipo']): AdminActividad {
  return { tipo, id: 'x-1', ocurridaEn: '2026-10-30T10:00:00Z' };
}

/** Canal admin falso: permite empujar actividad sin abrir un EventSource. */
function canalAdmin() {
  const eventos = new Subject<AdminActividad>();
  return { eventos, sse: { abrirAdminStream: vi.fn(() => eventos.asObservable()) } };
}

function liquidacion(overrides: Partial<LiquidacionResponse>): LiquidacionResponse {
  return {
    id: 'L1',
    otId: 'OT-1',
    otCodigo: 'OT-2026-0004',
    tecnicoId: 'TEC-1',
    tecnicoNombre: 'Juan',
    montoServicio: 100000,
    comision: 15000,
    estado: 'EN_VERIFICACION',
    medioPago: 'EFECTIVO',
    ...overrides,
  };
}

function setup(
  getTodasLiquidaciones?: ReturnType<typeof vi.fn>,
  tecnicosSinRed = false,
  sse?: CanalAdmin,
) {
  const liquidacionApi = {
    getTodasLiquidaciones: getTodasLiquidaciones ?? vi.fn(() =>
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
      tecnicosSinRed
        ? throwError(() => new Error('sin red'))
        : of<TecnicoResponse[]>([
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
      ...(sse ? [{ provide: SseService, useValue: sse }] : []),
    ],
  });
  const fixture = TestBed.createComponent(ConsignacionesAdminPage);
  fixture.detectChanges();
  return { fixture, liquidacionApi, tecnicosApi, toast };
}

describe('ConsignacionesAdminPage', () => {
  it('calcula los resúmenes de conciliación', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.enVerificacion().length).toBe(1);
    expect(fixture.componentInstance.tecnicosBloqueados().length).toBe(1);
    expect(fixture.componentInstance.totalComisionesAprobadas()).toBe(5000);
  });

  it('identifica cada consignación por el código de la OT, no por ids internos', () => {
    const { fixture } = setup();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('OT-2026-0004');
    expect(texto).not.toContain('L1');
    expect(texto).not.toContain('OT-1');
  });

  it('no reporta 0 técnicos bloqueados cuando el listado de técnicos no carga', () => {
    const { fixture } = setup(undefined, true);
    const texto = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.tecnicosDesconocidos()).toBe(true);
    expect(texto).toContain('No disponible: no pudimos cargar los técnicos');
    expect(texto).not.toContain('Con servicios en mora');
    // La cola de liquidaciones cargó bien: el fallo de técnicos no la tumba.
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    // Y su única fila mockeada sigue renderizada, con los totales del resumen.
    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('OT-2026-0004');
    expect(texto).not.toContain('Sin datos');
  });

  it('avisa si las liquidaciones no cargan y reintenta', () => {
    const getTodasLiquidaciones = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of([liquidacion({ id: 'L1' })]));
    const { fixture } = setup(getTodasLiquidaciones);

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las liquidaciones.');

    // Un fallo no autoriza a publicar ceros: el resumen se declara desconocido.
    const textoConError = fixture.nativeElement.textContent as string;
    expect(textoConError).toContain('No disponible: sin datos de liquidaciones');
    expect(textoConError).toContain('Sin datos');
    expect(textoConError).not.toContain('registros totales');
    expect(textoConError).not.toContain('Comisiones ingresadas en firme');
    expect(textoConError).not.toContain('Pendientes por conciliar extracto');
    expect(textoConError).not.toContain('$ 0 COP');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getTodasLiquidaciones).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.liquidaciones().length).toBe(1);
    // Con datos reales, el resumen vuelve a mostrar hechos.
    expect(fixture.nativeElement.textContent).toContain('1 registros totales');
    expect(fixture.nativeElement.textContent).toContain('Comisiones ingresadas en firme');
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

  describe('actividad administrativa en tiempo real', () => {
    afterEach(() => vi.useRealTimers());

    it('recarga con un comprobante cargado, después de la ventana de calma', () => {
      const { eventos, sse } = canalAdmin();
      const { liquidacionApi, tecnicosApi } = setup(undefined, false, sse);
      vi.useFakeTimers();

      eventos.next(actividad('COMPROBANTE_CARGADO'));
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(2);
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(2);
    });

    it('recarga con cualquier cambio de liquidación', () => {
      const { eventos, sse } = canalAdmin();
      const { liquidacionApi } = setup(undefined, false, sse);
      vi.useFakeTimers();

      eventos.next(actividad('LIQUIDACION_REGISTRADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(2);

      eventos.next(actividad('LIQUIDACION_APROBADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(3);

      eventos.next(actividad('LIQUIDACION_RECHAZADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(4);
    });

    it('ignora actividad que no es de consignaciones', () => {
      const { eventos, sse } = canalAdmin();
      const { liquidacionApi } = setup(undefined, false, sse);
      vi.useFakeTimers();

      eventos.next(actividad('DISPUTA_ABIERTA'));
      eventos.next(actividad('TECNICO_VALIDACION_RECHAZADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(1);
    });

    it('una ráfaga de eventos produce UNA sola recarga', () => {
      const { eventos, sse } = canalAdmin();
      const { liquidacionApi } = setup(undefined, false, sse);
      vi.useFakeTimers();

      eventos.next(actividad('COMPROBANTE_CARGADO'));
      eventos.next(actividad('LIQUIDACION_APROBADA'));
      eventos.next(actividad('COMPROBANTE_CARGADO'));

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(liquidacionApi.getTodasLiquidaciones).toHaveBeenCalledTimes(2);
    });
  });
});
