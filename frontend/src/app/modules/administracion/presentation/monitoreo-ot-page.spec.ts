import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MonitoreoOtPage } from './monitoreo-ot-page';
import { AdminApi } from '../infrastructure/admin-api';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'x',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function setup(getTodasOts: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [MonitoreoOtPage],
    providers: [provideRouter([]), { provide: AdminApi, useValue: { getTodasOts } }],
  });
  return TestBed.createComponent(MonitoreoOtPage);
}

describe('MonitoreoOtPage', () => {
  const ots = [
    ot({ id: 'OT-1', clienteNombre: 'Ana', barrio: 'Caobos', estado: 'EN_CAMINO' }),
    ot({ id: 'OT-2', clienteNombre: 'Luis', barrio: 'Centro', estado: 'FINALIZADA', categoriaServicio: 'ELECTRICIDAD' }),
  ];

  it('carga todas las OTs y las muestra sin filtros', () => {
    const fixture = setup(vi.fn(() => of(ots)));
    expect(fixture.componentInstance.otsFiltradas().length).toBe(2);
  });

  it('filtra por texto de búsqueda', () => {
    const fixture = setup(vi.fn(() => of(ots)));
    fixture.componentInstance.busquedaCtrl.setValue('ana');
    expect(fixture.componentInstance.otsFiltradas().map((o) => o.id)).toEqual(['OT-1']);
  });

  it('filtra por categoría', () => {
    const fixture = setup(vi.fn(() => of(ots)));
    fixture.componentInstance.filtroCategoriaCtrl.setValue('ELECTRICIDAD');
    expect(fixture.componentInstance.otsFiltradas().map((o) => o.id)).toEqual(['OT-2']);
  });

  it('filtra por estado', () => {
    const fixture = setup(vi.fn(() => of(ots)));
    fixture.componentInstance.filtroEstadoCtrl.setValue('FINALIZADA');
    expect(fixture.componentInstance.otsFiltradas().map((o) => o.id)).toEqual(['OT-2']);
  });

  it('deja la lista vacía si falla la carga', () => {
    const fixture = setup(vi.fn(() => throwError(() => new Error('sin red'))));
    expect(fixture.componentInstance.otsFiltradas()).toEqual([]);
  });
});
