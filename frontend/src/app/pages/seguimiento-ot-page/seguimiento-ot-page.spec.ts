import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject, of, throwError, Observable } from 'rxjs';
import { SeguimientoOtPage } from './seguimiento-ot-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../core/service/ot-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ApiConfig } from '../../core/service/api.config';
import { MockDbService } from '../../core/service/mock-db.service';
import { SseService, OtEstadoCambiado } from '../../core/service/sse.service';
import { MapsApi } from '../../core/service/maps-api';
import { RutaSeguimientoService } from '../../core/service/ruta-seguimiento.service';
import { RutaApi } from '../../core/models/backend.dto';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';
import { MapaSeguimiento } from '../../shared/mapa-seguimiento/mapa-seguimiento';
import { OtResponse, Point } from '../../core/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  codigo: 'OT-2026-0003',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  estado: 'EN_CAMINO',
  auxiliaresRequeridos: 0,
  tecnicoId: 'TEC-1',
  tecnicoNombre: 'Juan',
  tecnicoTelefono: '300',
  punto: { latitud: 7.88, longitud: -72.49 },
  radioBusquedaKm: 10,
};

/** Geometría sembrada que devuelve el backend en las pruebas. */
const RUTA_MAPA: RutaApi = { distanciaKm: 2.5, duracionMin: 6, polyline: 'abc_polyline' };

function setup(ot: OtResponse = orden, ruta$: () => Observable<RutaApi | null> = () => of(RUTA_MAPA)) {
  const clientesApi = {
    cancelarOt: vi.fn(() => of(undefined)),
    abrirDisputa: vi.fn(() => of({ id: 'd1' })),
    pagarVisita: vi.fn(() => of(undefined)),
  };
  const otApi = {
    getOtById: vi.fn(() => of(ot)),
    getTecnicoUbicacion: vi.fn((): Observable<Point | null> => of({ latitud: 7.9, longitud: -72.5 })),
    estimarTarifa: vi.fn(() => of({
      distanciaKm: 3.2,
      tarifaFuente: 'LINEAL' as const,
      banda: 0,
      tarifa: 30000,
      fueraDeRango: false,
    })),
  };
  const tecnicosApi = { getTecnicosCercanos: vi.fn(() => of([])) };
  const toast = { info: vi.fn(), warning: vi.fn(), error: vi.fn(), success: vi.fn() };
  const sseEventos = new Subject<OtEstadoCambiado>();
  const sse = { abrirOtStream: vi.fn(() => sseEventos.asObservable()) };
  // Ruta real por calles: el backend responde con una geometría sembrada.
  const mapsApi = { ruta: vi.fn(ruta$) };
  TestBed.configureTestingModule({
    imports: [SeguimientoOtPage],
    providers: [
      provideRouter([]),
      // Http real + controlador de pruebas: si algún camino volviera a pedir
      // la distancia a Google, la petición a /api/maps/distancia queda
      // registrada y el test falla.
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: ClientesApi, useValue: clientesApi },
      { provide: OtApi, useValue: otApi },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ApiConfig, useValue: { useMocks: () => false, url: (path: string) => `/api${path}` } },
      { provide: MockDbService, useValue: { ordenesTrabajo: () => [] } },
      { provide: SseService, useValue: sse },
      { provide: MapsApi, useValue: mapsApi },
      { provide: ToastService, useValue: toast },
      // El mapa es aditivo: en las pruebas no se carga el script de Google.
      { provide: GoogleMapsLoaderService, useValue: { isLoaded: () => false, isLoading: () => false, loadError: () => null, init: vi.fn() } },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(SeguimientoOtPage);
  fixture.detectChanges();
  return { fixture, clientesApi, otApi, toast, navigate, sse, sseEventos, http, mapsApi };
}

describe('SeguimientoOtPage', () => {
  it('carga la OT y calcula la distancia/ETA local', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    // Distancia en línea recta entre el técnico (7.9, -72.5) y el destino
    // (7.88, -72.49): 2,48 km y 6 min a 25 km/h.
    expect(fixture.componentInstance.distanciaKm()).toBe(2.48);
    expect(fixture.componentInstance.etaMin()).toBe(6);
  });

  it('muestra el cargo de visita con técnico asignado', () => {
    expect(setup().fixture.componentInstance.mostrarCargoVisita()).toBe(true);
  });

  it('permite cancelar en estados no finales', () => {
    expect(setup().fixture.componentInstance.puedeCancelar()).toBe(true);
  });

  it('no permite cancelar una OT finalizada', () => {
    const { fixture } = setup({ ...orden, estado: 'FINALIZADA' });
    expect(fixture.componentInstance.puedeCancelar()).toBe(false);
  });

  it('confirma la cancelación y navega al panel', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.motivoControl.setValue('ya no lo necesito');

    fixture.componentInstance.confirmarCancelacion();

    expect(clientesApi.cancelarOt).toHaveBeenCalledWith('ot1', 'ya no lo necesito');
    expect(toast.warning).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('no cancela sin motivo válido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.confirmarCancelacion();
    expect(clientesApi.cancelarOt).not.toHaveBeenCalled();
  });

  it('abre una disputa con motivo', () => {
    const { fixture, clientesApi, toast } = setup();
    fixture.componentInstance.motivoDisputaControl.setValue('cobro excesivo');

    fixture.componentInstance.confirmarDisputa();

    expect(clientesApi.abrirDisputa).toHaveBeenCalledWith('ot1', 'cobro excesivo');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.mostrarModalDisputa()).toBe(false);
  });

  it('reporta error con copy humana al abrir la disputa', () => {
    const { fixture, clientesApi, toast } = setup();
    // 409 real del backend: la orden cambió de estado o ya tiene disputa.
    clientesApi.abrirDisputa.mockReturnValue(
      throwError(() => new ApiHttpError('backend', 409)),
    );
    fixture.componentInstance.motivoDisputaControl.setValue('motivo válido');

    fixture.componentInstance.confirmarDisputa();

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo abrir la disputa',
      'La operación no se pudo completar porque el registro cambió de estado. Actualiza la página e inténtalo de nuevo.',
    );
  });

  it('actualiza el radio de búsqueda', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.actualizarRadio(15);
    expect(fixture.componentInstance.ot()?.radioBusquedaKm).toBe(15);
    expect(toast.info).toHaveBeenCalled();
  });

  it('oculta el pago de la visita cuando no hay presupuesto rechazado', () => {
    expect(setup({ ...orden, estado: 'EN_CAMINO' }).fixture.componentInstance.puedePagarVisita()).toBe(false);
  });

  it('no inventa un monto cuando la OT todavía no tiene presupuesto', () => {
    const { fixture } = setup({
      ...orden,
      estado: 'EN_DIAGNOSTICO',
      diagnostico: { fallaDetectada: 'compresor ruidoso' },
    });
    const texto = fixture.nativeElement.textContent as string;
    const enlace = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).find((a) => a.textContent?.includes('Revisar Presupuesto'));

    expect(texto).toMatch(/Revisar Presupuesto\s+\(sin presupuesto\)/);
    // Sin presupuesto no hay cifra que mostrar: nada de "$ 0".
    expect(enlace?.textContent).not.toContain('$');
    expect(texto).not.toContain('Revisar Presupuesto ($');
  });

  it('muestra el pago de la visita con el presupuesto rechazado (CANCELADA real)', () => {
    expect(setup({ ...orden, estado: 'CANCELADA' }).fixture.componentInstance.puedePagarVisita()).toBe(true);
  });

  it('muestra el pago de la visita con la disputa del mock (DISPUTADA)', () => {
    expect(setup({ ...orden, estado: 'DISPUTADA' }).fixture.componentInstance.puedePagarVisita()).toBe(true);
  });

  it('ofrece pagar la visita cuando la OT está ASIGNADA y sin pago (WS5)', () => {
    const { fixture } = setup({ ...orden, estado: 'ASIGNADA', visitaPagada: false });

    expect(fixture.componentInstance.puedePagarVisita()).toBe(true);
    // Pagar una ASIGNADA no reabre el despacho: solo habilita el desplazamiento.
    expect(fixture.componentInstance.pagoVisitaReabreDespacho()).toBe(false);
  });

  it('no ofrece pagar la visita cuando la OT ASIGNADA ya está pagada', () => {
    const { fixture } = setup({ ...orden, estado: 'ASIGNADA', visitaPagada: true });

    expect(fixture.componentInstance.puedePagarVisita()).toBe(false);
  });

  it('marca el pago de la visita como reapertura en CANCELADA', () => {
    expect(setup({ ...orden, estado: 'CANCELADA' }).fixture.componentInstance.pagoVisitaReabreDespacho()).toBe(true);
  });

  it('marca el pago de la visita como reapertura en DISPUTADA', () => {
    expect(setup({ ...orden, estado: 'DISPUTADA' }).fixture.componentInstance.pagoVisitaReabreDespacho()).toBe(true);
  });

  it('no marca reapertura cuando se paga una OT ASIGNADA', () => {
    const { fixture } = setup({ ...orden, estado: 'ASIGNADA', visitaPagada: false });
    expect(fixture.componentInstance.pagoVisitaReabreDespacho()).toBe(false);
  });

  it('avisa que el desplazamiento queda habilitado al pagar una OT ASIGNADA', () => {
    const { fixture, clientesApi, toast } = setup({ ...orden, estado: 'ASIGNADA', visitaPagada: false });
    fixture.componentInstance.medioPagoVisita.set('TRANSFERENCIA');

    fixture.componentInstance.pagarVisita();

    expect(clientesApi.pagarVisita).toHaveBeenCalledWith('ot1', 'TRANSFERENCIA');
    expect(toast.success).toHaveBeenCalledWith('Visita Pagada', 'Ya puedes iniciar el desplazamiento.');
  });

  it('paga la visita con el medio elegido, avisa y recarga la OT', () => {
    const { fixture, clientesApi, otApi, toast } = setup({ ...orden, estado: 'CANCELADA' });
    fixture.componentInstance.medioPagoVisita.set('TRANSFERENCIA');

    fixture.componentInstance.pagarVisita();

    expect(clientesApi.pagarVisita).toHaveBeenCalledWith('ot1', 'TRANSFERENCIA');
    expect(toast.success).toHaveBeenCalledWith('Visita Pagada', 'Despacho reabierto: buscando un técnico disponible.');
    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.pagandoVisita()).toBe(false);
  });

  it('reporta el error del backend al pagar la visita', () => {
    const { fixture, clientesApi, toast } = setup({ ...orden, estado: 'CANCELADA' });
    // 409 real del backend mientras el estado no admite el pago.
    clientesApi.pagarVisita.mockReturnValue(
      throwError(() => new ApiHttpError('doble cobro', 409)),
    );

    fixture.componentInstance.pagarVisita();

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo pagar la visita',
      'La operación no se pudo completar porque el registro cambió de estado. Actualiza la página e inténtalo de nuevo.',
    );
    expect(fixture.componentInstance.pagandoVisita()).toBe(false);
  });

  it('sondea la ubicación del técnico cuando la OT está asignada', () => {
    const { fixture, otApi } = setup();
    // El primer sondeo es inmediato (`startWith(0)`) y alimenta distancia/ETA.
    expect(otApi.getTecnicoUbicacion).toHaveBeenCalledWith('ot1');
    expect(fixture.componentInstance.tecnicoUbicacion()).toEqual({ latitud: 7.9, longitud: -72.5 });
  });

  it('no sondea la ubicación cuando la OT no tiene técnico asignado', () => {
    const { fixture, otApi } = setup({ ...orden, tecnicoId: null });
    expect(otApi.getTecnicoUbicacion).not.toHaveBeenCalled();
    expect(fixture.componentInstance.tecnicoUbicacion()).toBeNull();
    expect(fixture.componentInstance.mostrarCargoVisita()).toBe(false);
  });

  it('no sondea la ubicación en estados donde el técnico ya no se desplaza', () => {
    const { otApi } = setup({ ...orden, estado: 'FINALIZADA' });
    expect(otApi.getTecnicoUbicacion).not.toHaveBeenCalled();
  });

  it('abre el stream de cambios de estado de la OT cargada', () => {
    const { sse } = setup();
    expect(sse.abrirOtStream).toHaveBeenCalledWith('ot1');
  });

  it('recarga la OT al recibir un cambio de estado de la misma orden', () => {
    const { otApi, sseEventos } = setup();
    expect(otApi.getOtById).toHaveBeenCalledTimes(1);

    sseEventos.next({ otId: 'ot1', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
  });

  it('ignora un cambio de estado de otra orden', () => {
    const { otApi, sseEventos } = setup();

    sseEventos.next({ otId: 'ot-ajena', origen: 'SOLICITADA', destino: 'ASIGNADA' });

    expect(otApi.getOtById).toHaveBeenCalledTimes(1);
  });

  it('avisa que un técnico aceptó la orden', () => {
    const { toast, sseEventos } = setup();

    sseEventos.next({ otId: 'ot1', origen: 'BUSCANDO_TECNICO', destino: 'ASIGNADA' });

    expect(toast.info).toHaveBeenCalledWith(
      'Técnico asignado',
      'Un técnico aceptó tu orden de trabajo. Puedes seguir su avance en esta pantalla.',
    );
  });

  it('avisa que el técnico envió el presupuesto', () => {
    const { toast, sseEventos } = setup();

    sseEventos.next({ otId: 'ot1', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' });

    expect(toast.info).toHaveBeenCalledWith(
      'Presupuesto recibido',
      'El técnico envió el presupuesto de la reparación. Revísalo y apruébalo para continuar.',
    );
  });

  it('no avisa los estados que no son un momento importante', () => {
    const { toast, sseEventos } = setup();

    sseEventos.next({ otId: 'ot1', origen: 'ASIGNADA', destino: 'EN_CAMINO' });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('avisa si falla la cancelación y mantiene el modal para reintentar', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    clientesApi.cancelarOt.mockReturnValue(
      throwError(() => new ApiHttpError('El motivo es requerido', 400)),
    );
    fixture.componentInstance.mostrarModalCancelar.set(true);
    fixture.componentInstance.motivoControl.setValue('ya no lo necesito');

    fixture.componentInstance.confirmarCancelacion();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo cancelar el servicio', expect.any(String));
    // No navega al panel: la cancelación no quedó registrada.
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.mostrarModalCancelar()).toBe(true);
    expect(fixture.componentInstance.motivoControl.value).toBe('ya no lo necesito');
  });

  describe('tarjeta del técnico asignado', () => {
    it('muestra el nombre real del técnico', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Juan');
    });

    it('con técnico asignado pero sin nombre muestra el fallback honesto, no un hueco', () => {
      const { fixture } = setup({ ...orden, tecnicoNombre: undefined });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Buscando técnico…');
    });
  });

  describe('identificación de la OT', () => {
    // El `id` es el UUID interno del backend: la cabecera no debe mostrarlo.
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    it('encabeza la página con el código legible', () => {
      const { fixture } = setup({ ...orden, id: idInterno, codigo: 'OT-2026-0016' });
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('OT: OT-2026-0016');
      expect(texto).not.toContain(idInterno);
    });

    it('sin código del backend muestra un texto honesto, tampoco el id interno', () => {
      const { fixture } = setup({ ...orden, id: idInterno, codigo: undefined });
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('OT: Sin código');
      expect(texto).not.toContain(idInterno);
    });
  });

  describe('distancia y ETA locales (sin llamadas a Google Maps)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('el tick de posición NO llama a /api/maps/distancia y aun así actualiza la ETA', () => {
      const { fixture, otApi, http } = setup();
      // El primer sondeo es inmediato (`startWith(0)`) y ya fija distancia/ETA.
      expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.distanciaKm()).toBe(2.48);
      expect(fixture.componentInstance.etaMin()).toBe(6);

      // El técnico se acerca: el siguiente tick trae otra posición.
      otApi.getTecnicoUbicacion.mockReturnValue(of({ latitud: 7.885, longitud: -72.492 }));
      vi.advanceTimersByTime(15000);

      expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(2);
      // La ETA y la distancia se recalcularon en el navegador: 0,6 km y 1 min.
      expect(fixture.componentInstance.distanciaKm()).toBe(0.6);
      expect(fixture.componentInstance.etaMin()).toBe(1);

      // Y lo importante: ni una llamada a Distance Matrix en el tick.
      http.expectNone('/api/maps/distancia');
    });

    it('no llama a /api/maps/distancia en ningún tick del seguimiento', () => {
      const { otApi, http } = setup();

      vi.advanceTimersByTime(15000 * 4);

      expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(5);
      http.expectNone('/api/maps/distancia');
    });

    it('no sondea la ubicación con la pestaña oculta y reanuda al volver', () => {
      const visibilidad = (estado: 'visible' | 'hidden'): void => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      visibilidad('visible');
      try {
        const { otApi } = setup();
        // Primer sondeo inmediato, como en el resto de la página.
        expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(1);

        visibilidad('hidden');
        vi.advanceTimersByTime(15000 * 3);
        // En segundo plano no se gasta GPS ni red: cero pedidos.
        expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(1);

        visibilidad('visible');
        vi.advanceTimersByTime(15000);
        expect(otApi.getTecnicoUbicacion).toHaveBeenCalledTimes(2);
      } finally {
        delete (document as { visibilityState?: string }).visibilityState;
      }
    });

    it('sin posición del técnico no muestra ningún número', () => {
      const { fixture, otApi } = setup();
      // El técnico todavía no reportó ubicación: el backend responde null.
      otApi.getTecnicoUbicacion.mockReturnValue(of(null));
      vi.advanceTimersByTime(15000);

      expect(fixture.componentInstance.tecnicoUbicacion()).toBeNull();
      expect(fixture.componentInstance.distanciaKm()).toBeNull();
      expect(fixture.componentInstance.etaMin()).toBeNull();

      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('En camino a tu ubicación');
      // Sin ETA ni distancia: mejor sin dato que con un número falso.
      expect(texto).not.toContain('ETA');
    });
  });

  describe('mapa de seguimiento', () => {
    it('muestra el mapa de seguimiento cuando el técnico va en camino', () => {
      const { fixture } = setup({ ...orden, estado: 'EN_CAMINO' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-mapa-seguimiento')).toBeTruthy();
    });

    it('mientras se busca técnico se ve el radar, no el mapa de seguimiento', () => {
      const { fixture } = setup({ ...orden, estado: 'BUSCANDO_TECNICO', tecnicoId: null });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-mapa-radar')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-mapa-seguimiento')).toBeFalsy();
    });

    it('el marcador del mapa sigue la posición que llega del sondeo', () => {
      vi.useFakeTimers();
      try {
        const { fixture, otApi } = setup();
        const mapa = fixture.debugElement.query(By.directive(MapaSeguimiento)).componentInstance as MapaSeguimiento;
        fixture.detectChanges();

        // La posición del primer sondeo ya está en el mapa.
        expect(mapa.posicionMarcador()).toEqual({ lat: 7.9, lng: -72.5 });

        // El técnico se acerca: el siguiente tick mueve el marcador.
        otApi.getTecnicoUbicacion.mockReturnValue(of({ latitud: 7.885, longitud: -72.492 }));
        vi.advanceTimersByTime(15000);
        fixture.detectChanges();

        expect(mapa.posicionMarcador()).toEqual({ lat: 7.885, lng: -72.492 });
        // Y la ruta se dibuja entre el técnico y el punto de servicio.
        expect(mapa.ruta().length).toBe(2);
        expect(mapa.ruta()[1]).toEqual({ lat: 7.88, lng: -72.49 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('sin posición del técnico el mapa no muestra marcador ni ruta', () => {
      vi.useFakeTimers();
      try {
        const { fixture, otApi } = setup();
        // El técnico todavía no reportó ubicación: el backend responde null.
        otApi.getTecnicoUbicacion.mockReturnValue(of(null));
        vi.advanceTimersByTime(15000);
        fixture.detectChanges();

        const mapa = fixture.debugElement.query(By.directive(MapaSeguimiento)).componentInstance as MapaSeguimiento;
        expect(mapa.posicionMarcador()).toBeNull();
        expect(mapa.ruta()).toEqual([]);
        expect(mapa.distanciaKm()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('pasa la ruta real al mapa y no la pide en cada tick de 15 s', () => {
      vi.useFakeTimers();
      try {
        const { fixture, mapsApi } = setup();
        fixture.detectChanges();
        const mapa = fixture.debugElement.query(By.directive(MapaSeguimiento)).componentInstance as MapaSeguimiento;

        // Primer tick: una petición y el mapa recibe la geometría.
        expect(mapsApi.ruta).toHaveBeenCalledTimes(1);
        expect(mapa.rutaCodificada()).toBe('abc_polyline');

        // Tres ticks más (45 s): siguen siendo una sola petición pagada.
        vi.advanceTimersByTime(15000 * 3);
        fixture.detectChanges();
        expect(mapsApi.ruta).toHaveBeenCalledTimes(1);

        // Cumplidos los 60 s, el guard deja pasar el siguiente tick.
        vi.advanceTimersByTime(15000);
        fixture.detectChanges();
        expect(mapsApi.ruta).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('al destruir la página no queda pedido de ruta vivo', () => {
      const pendiente = new Subject<RutaApi | null>();
      const { fixture } = setup(orden, () => pendiente.asObservable());
      const servicio = fixture.debugElement.injector.get(RutaSeguimientoService);
      const detener = vi.spyOn(servicio, 'detener');

      fixture.destroy();

      expect(detener).toHaveBeenCalled();
      // La respuesta que llegue tarde ya no toca la pantalla.
      expect(() => {
        pendiente.next(RUTA_MAPA);
        pendiente.complete();
      }).not.toThrow();
    });
  });

  describe('llegada del técnico', () => {
    it('muestra el instante de la llegada cuando la OT trae llegadaEn', () => {
      const { fixture } = setup({ ...orden, llegadaEn: '2026-10-21T15:30:00Z' });
      fixture.detectChanges();

      const linea = fixture.nativeElement.querySelector('[data-testid="estado-tecnico"]') as HTMLElement;
      expect(linea.textContent).toContain('El técnico llegó');
      // Y el instante de la llegada, no solo el texto.
      expect(linea.textContent).toContain('2026');
      // Con el técnico en el sitio la ETA ya no aplica: no se muestra.
      expect(linea.textContent).not.toContain('En camino a tu ubicación');
      expect(fixture.nativeElement.textContent).not.toContain('Llegada estimada');
      // Y el mapa tampoco puede seguir diciendo "En camino:".
      expect(fixture.nativeElement.textContent).not.toContain('En camino:');
    });

    it('no muestra nada de la llegada mientras el técnico no ha llegado', () => {
      const { fixture } = setup();
      fixture.detectChanges();

      const linea = fixture.nativeElement.querySelector('[data-testid="estado-tecnico"]') as HTMLElement;
      expect(linea.textContent).not.toContain('El técnico llegó');
      // Sin `llegadaEn` no hay ni mensaje de "todavía no llegó": solo el estado normal.
      expect(linea.textContent).toContain('En camino a tu ubicación');
      // El mapa sigue en su comportamiento normal: "En camino:" con la distancia.
      expect(fixture.nativeElement.textContent).toContain('En camino:');
    });
  });

  describe('poll de respaldo cuando el stream SSE se rinde', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // El poll solo corre con la pestaña visible: se fija como el navegador.
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('arranca el poll y refresca la OT cuando el stream se cae', () => {
      const { otApi, sseEventos } = setup();
      // Todavía no falló: solo está la carga inicial de la ruta.
      expect(otApi.getOtById).toHaveBeenCalledTimes(1);

      sseEventos.error(new Error('stream agotado'));
      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(otApi.getOtById).toHaveBeenCalledTimes(2);

      // Y sigue refrescando en cada intervalo.
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      expect(otApi.getOtById).toHaveBeenCalledTimes(3);
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
