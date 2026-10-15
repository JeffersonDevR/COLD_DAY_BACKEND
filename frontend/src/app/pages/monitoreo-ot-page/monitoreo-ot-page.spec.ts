import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MonitoreoOtPage } from './monitoreo-ot-page';
import { AdminApi } from '../../core/service/admin-api';
import { OtResponse } from '../../core/models/common.models';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';

/** Alterna `document.visibilityState` como lo haría el navegador al cambiar de pestaña. */
function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

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

  describe('columna de técnico', () => {
    it('muestra el nombre real del técnico asignado', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: 'OT-1', clienteNombre: 'Ana', tecnicoNombre: 'Juan Pérez' })])));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Juan Pérez');
    });

    it('sin técnico asignado muestra el fallback honesto, no una celda en blanco', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: 'OT-1', clienteNombre: 'Ana' })])));
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Buscando técnico…');
    });
  });

  describe('refresco periódico con la pestaña visible', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('refresca el listado una vez por intervalo', () => {
      cambiarPestana('visible');
      const getTodasOts = vi.fn(() => of(ots));
      const fixture = setup(getTodasOts);
      expect(getTodasOts).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(getTodasOts).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.otsFiltradas().length).toBe(2);
    });

    it('no consulta mientras la pestaña está oculta', () => {
      cambiarPestana('hidden');
      const getTodasOts = vi.fn(() => of(ots));
      setup(getTodasOts);

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getTodasOts).toHaveBeenCalledTimes(1);
    });

    it('deja de refrescar al destruirse la página', () => {
      cambiarPestana('visible');
      const getTodasOts = vi.fn(() => of(ots));
      const fixture = setup(getTodasOts);

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getTodasOts).toHaveBeenCalledTimes(1);
    });
  });
});
