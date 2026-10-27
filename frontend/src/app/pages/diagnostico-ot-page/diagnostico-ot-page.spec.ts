import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DiagnosticoOtPage } from './diagnostico-ot-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../core/service/ot-api';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OtResponse } from '../../core/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'x',
  estado: 'EN_DIAGNOSTICO',
  auxiliaresRequeridos: 0,
  tecnicoNombre: 'Juan',
  punto: { latitud: 7.89, longitud: -72.5 },
  presupuesto: { aprobado: false, total: 150000, manoObra: 90000, repuestos: 60000 },
};

function setup(otRespuesta: OtResponse = orden) {
  const clientesApi = {
    aprobarDiagnostico: vi.fn(() => of(undefined)),
    rechazarDiagnostico: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const estimacion = {
    distanciaKm: 9.5,
    tarifaFuente: 'LINEAL' as const,
    banda: 1,
    tarifa: 35000,
    fueraDeRango: false,
  };
  const otApi = { getOtById: vi.fn(() => of(otRespuesta)), estimarTarifa: vi.fn(() => of(estimacion)) };
  const sseEventos = new Subject<OtEstadoCambiado>();
  const sse = { abrirOtStream: vi.fn(() => sseEventos.asObservable()) };
  TestBed.configureTestingModule({
    imports: [DiagnosticoOtPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: otApi },
      { provide: ClientesApi, useValue: clientesApi },
      { provide: SseService, useValue: sse },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3 }) } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DiagnosticoOtPage);
  fixture.detectChanges();
  return { fixture, clientesApi, toast, navigate, otApi, sse, sseEventos };
}

describe('DiagnosticoOtPage', () => {
  it('carga la OT y calcula el total del servicio', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(fixture.componentInstance.totalServicio()).toBe(185000);
  });

  it('aprueba el presupuesto y navega', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.aprobarPresupuesto();
    expect(clientesApi.aprobarDiagnostico).toHaveBeenCalledWith('ot1');
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('rechaza el presupuesto con motivo y navega', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.mostrarRechazo.set(true);
    fixture.componentInstance.motivoRechazoCtrl.setValue('costo elevado');

    fixture.componentInstance.rechazarPresupuesto();

    expect(clientesApi.rechazarDiagnostico).toHaveBeenCalledWith('ot1', 'costo elevado');
    expect(toast.warning).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('no rechaza sin motivo válido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.motivoRechazoCtrl.setValue('x');
    fixture.componentInstance.rechazarPresupuesto();
    expect(clientesApi.rechazarDiagnostico).not.toHaveBeenCalled();
  });

  it('reemplaza el chat falso por un banner no interactivo de "Próximamente"', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.textContent).toContain('Chat con Juan');
    expect(html.textContent).toContain('Próximamente');
    expect(html.textContent).toContain('Todavía no podés escribirle desde acá');
    // Sin formulario, sin input y sin burbujas de conversación inventadas.
    expect(html.querySelector('form')).toBeNull();
    expect(html.querySelector('input[type="text"]')).toBeNull();
    expect(html.textContent).not.toContain('En Línea');
    expect(html.textContent).not.toContain('garantía de 90 días');
  });

  it('sin dictamen ni presupuesto no inventa texto ni cifras', () => {
    const { fixture } = setup({ ...orden, diagnostico: undefined, presupuesto: undefined });
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('El técnico todavía no cargó el dictamen de este equipo.');
    expect(texto).toContain('El técnico todavía no cargó el presupuesto');
    expect(texto).not.toContain('condensador sucio');
    expect(texto).not.toContain('Capacitor 45uF');
    expect(texto).not.toContain('80.000');
    expect(texto).not.toContain('70.000');
  });

  it('muestra el dictamen y los montos reales cuando existen', () => {
    const { fixture } = setup({
      ...orden,
      diagnostico: { diagnostico: 'Fuga en la soldadura de baja presión.' },
      presupuesto: { aprobado: false, total: 150000, manoObra: 90000, repuestos: 60000, tiempoEstimadoHoras: 3 },
    });
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('Fuga en la soldadura de baja presión.');
    expect(texto).not.toContain('[object Object]');
    expect(texto).toContain('90.000');
    expect(texto).toContain('60.000');
    expect(texto).toContain('Tiempo estimado: 3 hora(s)');
  });

  it('abre el stream de cambios de estado de la OT cargada', () => {
    const { sse } = setup();
    expect(sse.abrirOtStream).toHaveBeenCalledWith('ot1');
  });

  it('recarga la OT y su estimación al recibir un cambio de estado de la misma orden', () => {
    const { otApi, sseEventos } = setup();
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
    expect(otApi.estimarTarifa).toHaveBeenCalledTimes(1);

    sseEventos.next({ otId: 'ot1', origen: 'EN_DIAGNOSTICO', destino: 'EN_REPARACION' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    expect(otApi.estimarTarifa).toHaveBeenCalledTimes(2);
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
    sseEventos.next({ otId: 'ot1', origen: 'EN_DIAGNOSTICO', destino: 'EN_REPARACION' });
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('avisa si falla la aprobación del presupuesto y no navega', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    clientesApi.aprobarDiagnostico.mockReturnValue(
      throwError(() => new ApiHttpError('La orden no está en diagnóstico', 409)),
    );

    fixture.componentInstance.aprobarPresupuesto();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo aprobar el presupuesto', expect.any(String));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('avisa si falla el rechazo y mantiene el modal con el motivo', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    clientesApi.rechazarDiagnostico.mockReturnValue(
      throwError(() => new ApiHttpError('El motivo es requerido', 400)),
    );
    fixture.componentInstance.mostrarRechazo.set(true);
    fixture.componentInstance.motivoRechazoCtrl.setValue('costo elevado');

    fixture.componentInstance.rechazarPresupuesto();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo rechazar el presupuesto', expect.any(String));
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.mostrarRechazo()).toBe(true);
    expect(fixture.componentInstance.motivoRechazoCtrl.value).toBe('costo elevado');
  });

  describe('nombre del técnico', () => {
    it('muestra el nombre real en el encabezado y en el chat', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Revisión en sitio por Juan');
      expect(texto).not.toContain('por asignar');
    });

    it('sin nombre muestra fallbacks honestos en lugar de una frase vacía o ambigua', () => {
      const { fixture } = setup({ ...orden, tecnicoNombre: undefined });
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Revisión en sitio por un técnico por asignar');
      expect(texto).toContain('Chat con el técnico por asignar');
      expect(texto).not.toContain('el técnico asignado');
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
