import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardAdminPage } from './dashboard-admin-page';
import { AdminApi } from '../infrastructure/admin-api';
import { MetricasAdminResponse } from '../../../core/shared/domain/models/common.models';

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

function setup() {
  TestBed.configureTestingModule({
    imports: [DashboardAdminPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: { getMetricas: vi.fn(() => of(metricas)) } },
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
});
