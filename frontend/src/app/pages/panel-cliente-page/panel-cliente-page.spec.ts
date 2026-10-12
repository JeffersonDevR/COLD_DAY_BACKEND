import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PanelClientePage } from './panel-cliente-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
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
    descripcionFalla: 'no enfría',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function setup(getOts: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [PanelClientePage],
    providers: [
      provideRouter([]),
      { provide: ClientesApi, useValue: { getOtsPorCliente: getOts } },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3, nombre: 'María' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PanelClientePage);
  fixture.detectChanges();
  return fixture;
}

describe('PanelClientePage', () => {
  it('separa servicios activos y finalizados', () => {
    const getOts = vi.fn(() =>
      of([
        ot({ id: 'a', estado: 'EN_CAMINO' }),
        ot({ id: 'b', estado: 'FINALIZADA' }),
        ot({ id: 'c', estado: 'CANCELADA' }),
      ]),
    );
    const fixture = setup(getOts);
    expect(fixture.componentInstance.serviciosActivos().length).toBe(1);
    expect(fixture.componentInstance.serviciosFinalizados().length).toBe(1);
    expect(getOts).toHaveBeenCalledWith('3');
  });

  it('deja la lista vacía si falla la carga', () => {
    const getOts = vi.fn(() => throwError(() => new Error('sin red')));
    const fixture = setup(getOts);
    expect(fixture.componentInstance.serviciosCliente()).toEqual([]);
  });

  it('muestra el estado vacío sin servicios activos', () => {
    const fixture = setup(vi.fn(() => of([])));
    expect(fixture.nativeElement.textContent).toContain('No tienes servicios en curso');
  });

  describe('refresco periódico con la pestaña visible', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('refresca la lista una vez por intervalo', () => {
      cambiarPestana('visible');
      const getOts = vi.fn(() => of([ot({ id: 'a', estado: 'EN_CAMINO' })]));
      const fixture = setup(getOts);
      expect(getOts).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(getOts).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.serviciosActivos().map((o) => o.id)).toEqual(['a']);
    });

    it('no consulta mientras la pestaña está oculta', () => {
      cambiarPestana('hidden');
      const getOts = vi.fn(() => of([ot({ id: 'a' })]));
      setup(getOts);

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getOts).toHaveBeenCalledTimes(1);
    });

    it('deja de refrescar al destruirse la página', () => {
      cambiarPestana('visible');
      const getOts = vi.fn(() => of([ot({ id: 'a' })]));
      const fixture = setup(getOts);

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(getOts).toHaveBeenCalledTimes(1);
    });
  });
});
