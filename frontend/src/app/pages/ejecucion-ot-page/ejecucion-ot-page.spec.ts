import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { EjecucionOtPage } from './ejecucion-ot-page';
import { MockDbService } from '../../core/service/mock-db.service';
import { ApiConfig } from '../../core/service/api.config';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { OtApi } from '../../core/service/ot-api';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OtResponse, Point, SolicitudInsumoResponse } from '../../core/models/common.models';

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

function requerimiento(overrides: Partial<SolicitudInsumoResponse> = {}): SolicitudInsumoResponse {
  return {
    id: 'REQ-001',
    otId: 'ot1',
    tecnicoId: 'TEC-001',
    estado: 'SOLICITADO',
    observaciones: 'Entrega en sitio',
    items: [{ descripcion: 'Capacitor 45uF', cantidad: 2 }],
    creadaEn: '2026-10-26T10:00:00Z',
    ...overrides,
  };
}

function setup(
  opts: { useMocks?: boolean; ot?: OtResponse; insumos?: SolicitudInsumoResponse[] } = {},
) {
  const tecnicosApi = {
    iniciarDesplazamiento: vi.fn(() => of(undefined)),
    llegarADomicilio: vi.fn(() => of(undefined)),
    registrarDiagnostico: vi.fn(() => of(undefined)),
    finalizarServicio: vi.fn(() => of(undefined)),
    getInsumosOt: vi.fn(() => of(opts.insumos ?? [])),
    solicitarInsumos: vi.fn(() => of(requerimiento({ id: 'REQ-NUEVO' }))),
  };
  const posicion = signal<Point | null>(null);
  const tracking = { ultimaPosicion: posicion.asReadonly(), iniciar: vi.fn(), detener: vi.fn() };
  const otApi = { getOtById: vi.fn(() => of(opts.ot ?? orden())) };
  const liquidacionApi = { registrarPago: vi.fn(() => of(undefined)) };
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const sseEventos = new Subject<OtEstadoCambiado>();
  const sse = { abrirOtStream: vi.fn(() => sseEventos.asObservable()) };

  TestBed.configureTestingModule({
    imports: [EjecucionOtPage],
    providers: [
      provideRouter([]),
      // Http real + controlador de pruebas: si el tick de posición volviera a
      // pedir la distancia a Google, la petición a /api/maps/distancia queda
      // registrada y el test falla.
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: MockDbService, useValue: { ordenesTrabajo: () => [opts.ot ?? orden()] } },
      { provide: ApiConfig, useValue: { useMocks: () => opts.useMocks ?? false, url: (path: string) => `/api${path}` } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: TecnicoTrackingService, useValue: tracking },
      { provide: OtApi, useValue: otApi },
      { provide: SseService, useValue: sse },
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(EjecucionOtPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, tracking, posicion, liquidacionApi, toast, otApi, sse, sseEventos, http };
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

  it('avisa que el cliente aprobó el presupuesto', () => {
    const { toast, sseEventos } = setup();

    sseEventos.next({ otId: 'ot1', origen: 'EN_DIAGNOSTICO', destino: 'EN_REPARACION' });

    expect(toast.info).toHaveBeenCalledWith(
      'Presupuesto aprobado',
      'El cliente aprobó tu presupuesto. Ya puedes empezar la reparación.',
    );
  });

  it('no avisa los estados que no son un momento importante', () => {
    const { toast, sseEventos } = setup();

    sseEventos.next({ otId: 'ot1', origen: 'EN_REPARACION', destino: 'FINALIZADA' });

    expect(toast.info).not.toHaveBeenCalled();
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

  describe('Repuestos a posteriori (roadmap 2.4)', () => {
    function construirLineas(c: EjecucionOtPage, descripcion: string, cantidad = 1): void {
      c.agregarRepuesto();
      const insumos = c.repuestosForm.controls.insumos;
      const ultimoIndice = insumos.length - 1;
      insumos.at(ultimoIndice).patchValue({ descripcion, cantidad });
    }

    it('carga el historial de repuestos al abrir la OT', () => {
      const { tecnicosApi } = setup();
      expect(tecnicosApi.getInsumosOt).toHaveBeenCalledWith('ot1');
    });

    it('lista vacía se muestra como estado vacío, no como error', () => {
      const { fixture } = setup();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Todavía no pediste repuestos para esta orden.');
      expect(fixture.componentInstance.repuestosErrorCarga()).toBeNull();
    });

    it('renderiza estado, observaciones e ítems de cada solicitud', () => {
      const { fixture } = setup({ insumos: [requerimiento()] });
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Solicitado');
      expect(texto).toContain('Entrega en sitio');
      expect(texto).toContain('2 × Capacitor 45uF');
    });

    it('SIN_PROVEEDOR se lee como reintentable, no como fila rota', () => {
      const { fixture } = setup({
        insumos: [requerimiento({ estado: 'SIN_PROVEEDOR', observaciones: undefined })],
      });
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Sin proveedor');
      expect(texto).toContain('Sin proveedores disponibles — podés reintentar.');
    });

    it('un fallo de carga deja la página en pie y muestra aviso con reintentar', () => {
      const { fixture, tecnicosApi } = setup();
      tecnicosApi.getInsumosOt.mockReturnValue(throwError(() => new ApiHttpError('ot ajena', 403)));
      fixture.componentInstance.cargarInsumos();
      fixture.detectChanges();

      expect(fixture.componentInstance.repuestosErrorCarga()).toBe(
        'No se pudo cargar el historial de repuestos de esta orden. Revisa tu conexión e inténtalo de nuevo.',
      );
      const texto = fixture.nativeElement.textContent as string;
      // La página sigue de pie: la cabecera no desaparece por un GET fallido.
      expect(texto).toContain('Ejecución OT: OT-2026-0002');
      expect(texto).toContain('Reintentar');
      // Nunca se escupe el mensaje crudo del backend.
      expect(texto).not.toContain('ot ajena');
    });

    it('envía la solicitud con líneas normalizadas y antepone el requerimiento creado', () => {
      const { fixture, tecnicosApi, toast } = setup();
      const c = fixture.componentInstance;
      c.repuestosForm.controls.observaciones.setValue('  urgente  ');
      construirLineas(c, ' Capacitor 45uF ', 2);
      c.enviarRepuestos();

      expect(tecnicosApi.solicitarInsumos).toHaveBeenCalledWith('ot1', {
        observaciones: 'urgente',
        insumos: [{ descripcion: 'Capacitor 45uF', cantidad: 2 }],
      });
      expect(c.insumosOt()[0].id).toBe('REQ-NUEVO');
      expect(c.repuestosForm.controls.insumos.length).toBe(0);
      expect(toast.success).toHaveBeenCalledWith('Repuestos solicitados', expect.any(String));
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('sin líneas la solicitud no se envía', () => {
      const { fixture, tecnicosApi, toast } = setup();
      const c = fixture.componentInstance;
      c.enviarRepuestos();
      expect(tecnicosApi.solicitarInsumos).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('un 409 al enviar muestra copy humana y conserva el formulario', () => {
      const { fixture, tecnicosApi, toast } = setup();
      const c = fixture.componentInstance;
      construirLineas(c, 'Bomba de drenaje', 1);
      tecnicosApi.solicitarInsumos.mockReturnValue(
        throwError(() => new ApiHttpError('SolicitudInsumosInvalida', 409)),
      );
      c.enviarRepuestos();

      expect(toast.error).toHaveBeenCalledWith(
        'No se pudieron solicitar los repuestos',
        'La orden cambió de estado y ya no acepta repuestos nuevos. Actualiza la página para ver el estado actual.',
      );
      // El form queda intacto para reintentar.
      expect(c.repuestosForm.controls.insumos.length).toBe(1);
    });

    it('bloquea el envío cuando la OT quedó en estado terminal', () => {
      const { fixture } = setup({ ot: orden({ estado: 'FINALIZADA' }) });
      const c = fixture.componentInstance;
      expect(c.repuestosPermitidos()).toBe(false);
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Esta orden ya no acepta repuestos nuevos.');
    });
  });

  describe('distancia y ETA locales (sin llamadas a Google Maps)', () => {
    it('el tick de posición NO llama a /api/maps/distancia y calcula la ETA en el navegador', () => {
      const { fixture, posicion, http } = setup();

      // El técnico reporta su posición: el tick recalcula la ruta local.
      posicion.set({ latitud: 7.9, longitud: -72.5 });
      fixture.detectChanges();

      // Distancia en línea recta entre el técnico (7.9, -72.5) y el destino
      // (7.88, -72.49): 2,48 km y 6 min a 25 km/h.
      expect(fixture.componentInstance.distanciaKm()).toBe(2.48);
      expect(fixture.componentInstance.etaMin()).toBe(6);

      // Y lo importante: ni una llamada a Distance Matrix en el tick.
      http.expectNone('/api/maps/distancia');
    });

    it('no llama a /api/maps/distancia en ningún tick de posición', () => {
      const { fixture, posicion, http } = setup();

      posicion.set({ latitud: 7.9, longitud: -72.5 });
      fixture.detectChanges();
      posicion.set({ latitud: 7.885, longitud: -72.492 });
      fixture.detectChanges();

      // La ETA local sí se recalculó en cada tick: 0,6 km y 1 min.
      expect(fixture.componentInstance.distanciaKm()).toBe(0.6);
      expect(fixture.componentInstance.etaMin()).toBe(1);
      http.expectNone('/api/maps/distancia');
    });

    it('sin posición del técnico no muestra ningún número', () => {
      const { fixture, http } = setup();

      expect(fixture.componentInstance.distanciaKm()).toBeNull();
      expect(fixture.componentInstance.etaMin()).toBeNull();

      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      // Sin ETA ni distancia: mejor sin dato que con un número falso.
      expect(texto).not.toContain('ETA al cliente');

      http.expectNone('/api/maps/distancia');
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
