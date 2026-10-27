import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardAdminPage } from './dashboard-admin-page';
import { AdminApi } from '../../core/service/admin-api';
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

function setup(getMetricas: ReturnType<typeof vi.fn> = vi.fn(() => of(metricas))) {
  TestBed.configureTestingModule({
    imports: [DashboardAdminPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: { getMetricas } },
    ],
  });
  const fixture = TestBed.createComponent(DashboardAdminPage);
  fixture.detectChanges();
  return fixture;
}

describe('DashboardAdminPage', () => {
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
});
