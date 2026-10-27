import { Subscription } from 'rxjs';
import { POLL_INTERVAL_MS, pollVisibleTab, visibleTabChanges } from './visible-tab-polling';

/**
 * jsdom expone `document.visibilityState` como getter de solo lectura sobre el
 * prototipo; el doble lo redefine como propiedad propia para poder alternar
 * entre visible y oculta igual que lo haría el navegador.
 */
function simularVisibilidad(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => estado,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('pollVisibleTab', () => {
  let suscripcion: Subscription | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    simularVisibilidad('visible');
  });

  afterEach(() => {
    suscripcion?.unsubscribe();
    suscripcion = undefined;
    vi.useRealTimers();
    delete (document as { visibilityState?: string }).visibilityState;
  });

  it('emite un tick por intervalo mientras la pestaña está visible', () => {
    const ticks: number[] = [];
    suscripcion = pollVisibleTab().subscribe((tick) => ticks.push(tick));

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(ticks.length).toBe(1);

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(ticks.length).toBe(2);
  });

  it('no emite nada si la pestaña arranca oculta', () => {
    simularVisibilidad('hidden');
    const ticks: number[] = [];
    suscripcion = pollVisibleTab().subscribe((tick) => ticks.push(tick));

    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

    expect(ticks.length).toBe(0);
  });

  it('pausa al ocultarse la pestaña y reanuda al volver a estar visible', () => {
    const ticks: number[] = [];
    suscripcion = pollVisibleTab().subscribe((tick) => ticks.push(tick));

    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(ticks.length).toBe(1);

    simularVisibilidad('hidden');
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    expect(ticks.length).toBe(1);

    simularVisibilidad('visible');
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(ticks.length).toBe(2);
  });

  it('visibleTabChanges emite el estado actual y cada cambio, sin repetidos', () => {
    const estados: boolean[] = [];
    suscripcion = visibleTabChanges().subscribe((visible) => estados.push(visible));

    expect(estados).toEqual([true]);

    simularVisibilidad('hidden');
    expect(estados).toEqual([true, false]);

    // Un evento sin cambio real no vuelve a emitir.
    simularVisibilidad('hidden');
    expect(estados).toEqual([true, false]);

    simularVisibilidad('visible');
    expect(estados).toEqual([true, false, true]);
  });

  it('deja de emitir al desuscribirse', () => {    const ticks: number[] = [];
    suscripcion = pollVisibleTab().subscribe((tick) => ticks.push(tick));
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    expect(ticks.length).toBe(1);

    suscripcion.unsubscribe();
    suscripcion = undefined;
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

    expect(ticks.length).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
