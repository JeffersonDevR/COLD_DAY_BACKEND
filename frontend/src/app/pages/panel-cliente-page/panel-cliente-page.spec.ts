import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FiltroOts, PanelClientePage } from './panel-cliente-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { OtResponse } from '../../core/models/common.models';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';
import { CLAVE_PANEL_PREFERIDO } from '../../core/navihationError/panel-resolver';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';

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
  it('recuerda el panel del cliente como último panel visitado', () => {
    window.localStorage.clear();

    setup(vi.fn(() => of([])));

    expect(window.localStorage.getItem(CLAVE_PANEL_PREFERIDO)).toBe('/cliente/panel');
  });

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

  /**
   * Mezcla representativa del panel: una OT en curso con técnico, una finalizada,
   * una cancelada y una que todavía espera asignación.
   */
  function otsDeEjemplo(): OtResponse[] {
    return [
      ot({ id: 'en-camino', estado: 'EN_CAMINO', tecnicoId: 'tec-1' }),
      ot({ id: 'finalizada', estado: 'FINALIZADA', tecnicoId: 'tec-1' }),
      ot({ id: 'cancelada', estado: 'CANCELADA' }),
      ot({ id: 'solicitada', estado: 'SOLICITADA' }),
    ];
  }

  /** Aplica un filtro y devuelve los ids visibles, en el orden en que se muestran. */
  function idsVisibles(fixture: ComponentFixture<PanelClientePage>, filtro: FiltroOts): string[] {
    fixture.componentInstance.filtro.set(filtro);
    return fixture.componentInstance.serviciosFiltrados().map((o) => o.id);
  }

  it('deja la lista vacía si falla la carga', () => {
    const getOts = vi.fn(() => throwError(() => new Error('sin red')));
    const fixture = setup(getOts);
    expect(fixture.componentInstance.serviciosCliente()).toEqual([]);
  });

  it('un técnico sin perfil de cliente ve el alta honesta, no la lista vacía', () => {
    const getOts = vi.fn(() =>
      throwError(() => new ApiHttpError('No existe un perfil de cliente para el usuario: 6', 404)),
    );
    const fixture = setup(getOts, { id: 6, nombre: 'Juan' });
    const texto = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.sinPerfilCliente()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test="panel-sin-perfil-cliente"]')).not.toBeNull();
    expect(texto).toContain('Todavía no tenés perfil de cliente');
    expect(texto).toContain('Crear mi perfil de cliente');
    // El 404 de perfil no es una falla de carga ni un listado vacío genérico.
    expect(texto).not.toContain('No tienes servicios en curso');
  });

  it('un técnico con perfil de cliente ve sus órdenes', () => {
    const fixture = setup(
      vi.fn(() => of([ot({ id: 'en-camino', estado: 'EN_CAMINO', tecnicoId: 'tec-1' })])),
      { id: 6, nombre: 'Juan' },
    );

    expect(fixture.componentInstance.sinPerfilCliente()).toBe(false);
    expect(fixture.componentInstance.serviciosActivos().map((o) => o.id)).toEqual(['en-camino']);
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

  describe('filtro de OTs por estado', () => {
    it('arranca en la vista de activas, la que el cliente ya conoce', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      expect(fixture.componentInstance.filtro()).toBe('ACTIVAS');
      expect(fixture.componentInstance.serviciosFiltrados().map((o) => o.id)).toEqual(['en-camino', 'solicitada']);
    });

    it('TODAS muestra todas las OTs del cliente, incluidas las canceladas', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      expect(idsVisibles(fixture, 'TODAS')).toEqual(['en-camino', 'finalizada', 'cancelada', 'solicitada']);
    });

    it('ACTIVAS deja fuera las finalizadas y las canceladas', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      expect(idsVisibles(fixture, 'ACTIVAS')).toEqual(['en-camino', 'solicitada']);
    });

    it('COMPLETADAS muestra solo las finalizadas', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      expect(idsVisibles(fixture, 'COMPLETADAS')).toEqual(['finalizada']);
    });

    it('SIN_TECNICO muestra solo las que todavía esperan un técnico', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      expect(idsVisibles(fixture, 'SIN_TECNICO')).toEqual(['solicitada']);
    });

    it('una OT cancelada sin técnico no aparece ni en ACTIVAS ni en SIN_TECNICO', () => {
      // Cancelar quita la OT de la vista del cliente: no es trabajo pendiente
      // ni una espera de asignación, y solo se ve en TODAS.
      const fixture = setup(vi.fn(() => of([ot({ id: 'cancelada', estado: 'CANCELADA' })])));
      expect(idsVisibles(fixture, 'ACTIVAS')).toEqual([]);
      expect(idsVisibles(fixture, 'SIN_TECNICO')).toEqual([]);
      expect(idsVisibles(fixture, 'TODAS')).toEqual(['cancelada']);
    });

    it('los contadores de las métricas no cambian al cambiar de filtro', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      const activos = fixture.componentInstance.serviciosActivos().length;
      const finalizados = fixture.componentInstance.serviciosFinalizados().length;
      expect(activos).toBe(2);
      expect(finalizados).toBe(1);

      for (const filtro of ['TODAS', 'ACTIVAS', 'COMPLETADAS', 'SIN_TECNICO'] as const) {
        fixture.componentInstance.filtro.set(filtro);
        expect(fixture.componentInstance.serviciosActivos().length).toBe(activos);
        expect(fixture.componentInstance.serviciosFinalizados().length).toBe(finalizados);
      }
    });

    it('el control segmentado cambia la vista y marca la opción elegida', () => {
      const fixture = setup(vi.fn(() => of(otsDeEjemplo())));
      const grupo = fixture.nativeElement.querySelector('[role="group"]') as HTMLElement;
      const botones = Array.from(grupo.querySelectorAll('button'));
      expect(botones.map((b) => b.textContent?.trim())).toEqual(['Todas', 'Activas', 'Completadas', 'Sin técnico']);

      const completadas = botones.find((b) => b.textContent?.trim() === 'Completadas') as HTMLButtonElement;
      expect(completadas.type).toBe('button');
      completadas.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filtro()).toBe('COMPLETADAS');
      expect(completadas.getAttribute('aria-pressed')).toBe('true');
    });

    it('el estado vacío dice qué falta según el filtro', () => {
      // Con técnico asignado: solo queda vacío en COMPLETADAS y en SIN_TECNICO.
      const fixture = setup(vi.fn(() => of([ot({ id: 'a', estado: 'EN_CAMINO', tecnicoId: 'tec-1' })])));

      fixture.componentInstance.filtro.set('COMPLETADAS');
      fixture.detectChanges();
      let texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Todavía no tienes servicios completados');
      expect(texto).not.toContain('No tienes servicios en curso');

      fixture.componentInstance.filtro.set('SIN_TECNICO');
      fixture.detectChanges();
      texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('No tienes servicios esperando técnico');
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
