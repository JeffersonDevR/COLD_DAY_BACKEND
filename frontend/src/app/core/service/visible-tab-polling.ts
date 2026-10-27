import { EMPTY, Observable, fromEvent, interval, of } from 'rxjs';
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
 * Estado de visibilidad de la pestaña: emite el valor actual y luego cada
 * cambio, sin repetidos.
 *
 * Es la base de `pollVisibleTab` y de cualquier trabajo periódico que deba
 * parar cuando la pestaña queda en segundo plano (GPS, reportes de posición):
 * un timer que sigue corriendo escondido gasta batería y cuota sin que nadie
 * mire el resultado.
 */
export function visibleTabChanges(): Observable<boolean> {
  if (typeof document === 'undefined') {
    // Sin `document` no hay pestaña que ocultar: una sola emisión alcanza.
    return of(true);
  }
  return fromEvent(document, 'visibilitychange').pipe(
    map(() => tabVisible()),
    startWith(tabVisible()),
    distinctUntilChanged(),
  );
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

  return visibleTabChanges().pipe(switchMap((visible) => (visible ? interval(intervaloMs) : EMPTY)));
}
