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
    codigo: 'OT-2026-0001',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function setup(getOts: ReturnType<typeof vi.fn>, sesion: { id: number; nombre?: string } = { id: 3, nombre: 'María' }) {
  TestBed.configureTestingModule({
    imports: [PanelClientePage],
    providers: [
      provideRouter([]),
      { provide: ClientesApi, useValue: { getOtsPorCliente: getOts } },
      { provide: AuthService, useValue: { currentUser: () => sesion } },
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

  describe('saludo del panel', () => {
    it('saluda con el nombre real de la sesión', () => {
      const fixture = setup(vi.fn(() => of([])));
      expect(fixture.nativeElement.textContent).toContain('Hola, María');
    });

    it('con una sesión sin nombre saluda con una etiqueta honesta, no con "Usuario"', () => {
      // El JWT real no emite `nombre`; un saludo con el literal "Usuario"
      // nombra a la persona con un rótulo genérico que nunca le corresponde.
      const fixture = setup(vi.fn(() => of([])), { id: 3 });
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Hola, Cliente');
      expect(texto).not.toContain('Usuario');
    });
  });

  describe('identificación de la OT', () => {
    // El `id` es el UUID interno del backend: nunca se muestra al cliente.
    const idInterno = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    it('muestra el código legible y no el id interno', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: idInterno, codigo: 'OT-2026-0013', estado: 'EN_CAMINO' })])));
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('OT-2026-0013');
      expect(texto).not.toContain(idInterno);
    });

    it('sin código del backend muestra un texto honesto, tampoco el id interno', () => {
      const fixture = setup(vi.fn(() => of([ot({ id: idInterno, codigo: undefined, estado: 'EN_CAMINO' })])));
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
