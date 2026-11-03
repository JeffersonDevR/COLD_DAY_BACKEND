import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of, Subject, throwError } from 'rxjs';
import { DashboardAdminPage } from './dashboard-admin-page';
import { AdminApi } from '../../core/service/admin-api';
import { ESPERA_RECARGA_ADMIN_MS } from '../../core/service/admin-actividad-refresco';
import { AdminActividad, SseService } from '../../core/service/sse.service';
import { MetricasAdminResponse } from '../../core/models/common.models';

const metricas: MetricasAdminResponse = {
  serviciosEnEjecucion: 4,
  tecnicosVerificados: 3,
  tecnicosDisponibles: 2,
  tiempoPromedioRespuestaMin: 1.5,
  incidenciasActivas: 1,
  totalRecaudoMesCop: 5000000,
  comisionesMesCop: 750000,
  distribucionCategorias: [
    { categoria: 'AIRE_ACONDICIONADO', cantidad: 10, porcentaje: 50 },
    { categoria: 'REFRIGERACION', cantidad: 10, porcentaje: 50 },
  ],
  historicoSemanal: [{ dia: 'Lun', completadas: 8, canceladas: 1 }],
};

function actividad(tipo: AdminActividad['tipo']): AdminActividad {
  return { tipo, id: 'x-1', ocurridaEn: '2026-10-30T10:00:00Z' };
}

/** Canal admin falso: permite empujar actividad sin abrir un EventSource. */
function canalAdmin() {
  const eventos = new Subject<AdminActividad>();
  return { eventos, sse: { abrirAdminStream: vi.fn(() => eventos.asObservable()) } };
}

function setup(
  getMetricas: ReturnType<typeof vi.fn> = vi.fn(() => of(metricas)),
  sse?: { abrirAdminStream: ReturnType<typeof vi.fn> },
) {
  TestBed.configureTestingModule({
    imports: [DashboardAdminPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: { getMetricas } },
      // Sin canal explícito, el stream se completa vacío: la degradación real.
      { provide: SseService, useValue: sse ?? { abrirAdminStream: () => EMPTY } },
    ],
  });
  const fixture = TestBed.createComponent(DashboardAdminPage);
  fixture.detectChanges();
  return fixture;
}

describe('DashboardAdminPage', () => {
  afterEach(() => vi.useRealTimers());

  it('carga las métricas al iniciar', () => {
    const fixture = setup();
    expect(fixture.componentInstance.metricas()?.serviciosEnEjecucion).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Torre de Control Administrativa');
  });

  it('calcula la distribución de la dona', () => {
    const fixture = setup();
    const distribucion = fixture.componentInstance.distribucion();
    expect(distribucion.length).toBe(2);
    expect(distribucion[0].color).toBe('#0284c7');
    expect(distribucion[1].dashoffset).not.toBe('0');
  });

  it('suma el total de servicios', () => {
    expect(setup().componentInstance.totalServicios()).toBe(20);
  });

  it('avisa cuando las métricas no cargan y reintenta', () => {
    const getMetricas = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of(metricas));
    const fixture = setup(getMetricas);
    const texto = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(texto).toContain('No pudimos cargar las métricas de la torre de control.');
    expect(fixture.nativeElement.querySelector('[role="alert"] button')?.textContent?.trim()).toBe('Reintentar');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getMetricas).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.metricas()?.serviciosEnEjecucion).toBe(4);
  });

  describe('actividad administrativa en tiempo real', () => {
    it('recarga la torre con cualquier actividad, después de la ventana de calma', () => {
      const getMetricas = vi.fn(() => of(metricas));
      const { eventos, sse } = canalAdmin();
      setup(getMetricas, sse);
      vi.useFakeTimers();

      eventos.next(actividad('TECNICO_VALIDADO'));
      // Todavía dentro del debounce: no hay recarga.
      expect(getMetricas).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(getMetricas).toHaveBeenCalledTimes(2);
    });

    it('una ráfaga de eventos produce UNA sola recarga', () => {
      const getMetricas = vi.fn(() => of(metricas));
      const { eventos, sse } = canalAdmin();
      setup(getMetricas, sse);
      vi.useFakeTimers();

      eventos.next(actividad('DISPUTA_ABIERTA'));
      eventos.next(actividad('LIQUIDACION_APROBADA'));
      eventos.next(actividad('COMPROBANTE_CARGADO'));

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(getMetricas).toHaveBeenCalledTimes(2);
    });

    it('sin eventos del canal admin la torre sigue cargando y reintentando', () => {
      const getMetricas = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('sin red')))
        .mockReturnValueOnce(of(metricas));
      const fixture = setup(getMetricas);

      expect(fixture.componentInstance.errorCarga()).toBe(true);
      fixture.componentInstance.cargarMetricas();

      expect(getMetricas).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.errorCarga()).toBe(false);
    });

    it('no solapa recargas: con una en vuelo deja UNA pendiente', () => {
      const enVuelo = new Subject<MetricasAdminResponse>();
      const getMetricas = vi
        .fn()
        .mockReturnValueOnce(of(metricas))
        .mockReturnValueOnce(enVuelo.asObservable())
        .mockReturnValue(of(metricas));
      const { eventos, sse } = canalAdmin();
      setup(getMetricas, sse);
      vi.useFakeTimers();

      eventos.next(actividad('DISPUTA_ABIERTA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(getMetricas).toHaveBeenCalledTimes(2);

      // Llega más actividad mientras la recarga sigue en vuelo.
      eventos.next(actividad('LIQUIDACION_APROBADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(getMetricas).toHaveBeenCalledTimes(2);

      // Al terminar, recién ahí corre la pendiente (una sola).
      enVuelo.next(metricas);
      enVuelo.complete();
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(getMetricas).toHaveBeenCalledTimes(3);
    });

    it('al destruir la pantalla no queda un refresco pendiente', () => {
      const getMetricas = vi.fn(() => of(metricas));
      const { eventos, sse } = canalAdmin();
      const fixture = setup(getMetricas, sse);
      vi.useFakeTimers();

      eventos.next(actividad('DISPUTA_ABIERTA'));
      fixture.destroy();
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(getMetricas).toHaveBeenCalledTimes(1);
    });
  });
});
