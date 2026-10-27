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
    codigo: 'OT-2026-0001',
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
    ot({ id: 'OT-1', codigo: 'OT-2026-0001', clienteNombre: 'Ana', barrio: 'Caobos', estado: 'EN_CAMINO' }),
    ot({ id: 'OT-2', codigo: 'OT-2026-0002', clienteNombre: 'Luis', barrio: 'Centro', estado: 'FINALIZADA', categoriaServicio: 'ELECTRICIDAD' }),
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

  it('filtra por el código de OT que la tabla muestra, no por el id interno', () => {
    const fixture = setup(vi.fn(() => of(ots)));
    // La tabla muestra `codigo` (OT-2026-0002); el id interno es 'OT-2'.
    fixture.componentInstance.busquedaCtrl.setValue('OT-2026-0002');
    expect(fixture.componentInstance.otsFiltradas().map((o) => o.id)).toEqual(['OT-2']);
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

  it('no muestra un monto inventado cuando la OT no tiene presupuesto', () => {
    const fixture = setup(vi.fn(() => of([ot({ id: 'OT-3', codigo: 'OT-2026-0003' })])));
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('Sin presupuesto');
    expect(texto).not.toContain('$');
  });

  it('avisa cuando la carga falla y reintenta con el botón', () => {
    const getTodasOts = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of(ots));
    const fixture = setup(getTodasOts);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las órdenes de trabajo.');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getTodasOts).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.otsFiltradas().length).toBe(2);
  });

  it('un fallo del refresco periódico no reemplaza la tabla por el aviso', () => {
    vi.useFakeTimers();
    cambiarPestana('visible');
    const getTodasOts = vi
      .fn()
      .mockReturnValueOnce(of(ots))
      .mockReturnValueOnce(throwError(() => new Error('sin red')));
    const fixture = setup(getTodasOts);

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.otsFiltradas().length).toBe(2);
    vi.useRealTimers();
    delete (document as { visibilityState?: string }).visibilityState;
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

  describe('columna de identificación', () => {
    // El `id` es el UUID interno del backend: nunca debe llegar a la tabla.
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    it('muestra el código legible y no el id interno', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: idInterno, codigo: 'OT-2026-0012', clienteNombre: 'Ana' })])));
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('OT-2026-0012');
      expect(texto).not.toContain(idInterno);
    });

    it('sin código del backend muestra un texto honesto, tampoco el id interno', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: idInterno, codigo: undefined, clienteNombre: 'Ana' })])));
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Sin código');
      expect(texto).not.toContain(idInterno);
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
