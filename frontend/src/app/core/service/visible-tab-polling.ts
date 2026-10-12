import { EMPTY, Observable, fromEvent, interval } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

/**
 * Intervalo del refresco periódico de listados: 25 s. Un único pedido por
 * intervalo, sin importar cuántos elementos tenga la lista.
 */
export const POLL_INTERVAL_MS = 25_000;

/** `true` mientras la pestaña está visible. En SSR (sin `document`) se asume visible. */
export function tabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Emite un tick cada `intervaloMs` SOLO mientras la pestaña está visible.
 *
 * - Ocultar la pestaña CANCELA el intervalo (no se acumulan ticks perdidos) y
 *   volver a mostrarla arranca un ciclo nuevo.
 * - Es frío: cada suscripción tiene su propio contador, y desuscribirse lo apaga.
 *   En los componentes se combina con `takeUntilDestroyed` para cortarlo al
 *   destruirse la página.
 */
export function pollVisibleTab(intervaloMs: number = POLL_INTERVAL_MS): Observable<number> {
  // Sin `document` (render en el servidor) no hay pestaña que refrescar: un
  // intervalo en SSR solo generaría pedidos sin consumidor.
  if (typeof document === 'undefined') {
    return EMPTY;
  }

  const visibilidad$ = fromEvent(document, 'visibilitychange').pipe(
    map(() => tabVisible()),
    startWith(tabVisible()),
    distinctUntilChanged(),
  );

  return visibilidad$.pipe(switchMap((visible) => (visible ? interval(intervaloMs) : EMPTY)));
}
