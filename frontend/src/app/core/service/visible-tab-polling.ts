import { InjectionToken, inject } from '@angular/core';
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
 * Fuente de visibilidad de la app.
 *
 * En la web es `document.visibilityState`; en la app móvil el WebView puede no
 * disparar `visibilitychange` al pasar a segundo plano, así que el proyecto
 * `mobile` provee esta misma señal desde `App.addListener('appStateChange')`.
 * El default queda igual que antes para no cambiar el comportamiento web.
 */
export const VISIBILITY_SOURCE = new InjectionToken<Observable<boolean>>('VISIBILITY_SOURCE', {
  providedIn: 'root',
  factory: () => defaultVisibility(),
});

/** Señal de visibilidad por defecto (web / SSR). */
export function defaultVisibility(): Observable<boolean> {
  if (typeof document === 'undefined') {
    return of(true);
  }
  return fromEvent(document, 'visibilitychange').pipe(
    map(() => tabVisible()),
    startWith(tabVisible()),
    distinctUntilChanged(),
  );
}

/**
 * Estado de visibilidad de la app: emite el valor actual y luego cada cambio,
 * sin repetidos.
 *
 * Es la base de `pollVisibleTab` y de cualquier trabajo periódico que deba
 * parar cuando la app queda en segundo plano (GPS, reportes de posición): un
 * timer que sigue corriendo escondido gasta batería y cuota sin que nadie mire
 * el resultado.
 */
export function visibleTabChanges(): Observable<boolean> {
  // Fuera de un contexto de inyección (specs de utilidades, llamadas sueltas)
  // se usa la señal web por defecto en vez de fallar con NG0203.
  try {
    return inject(VISIBILITY_SOURCE);
  } catch {
    return defaultVisibility();
  }
}

/**
 * Emite un tick cada `intervaloMs` SOLO mientras la app está visible.
 *
 * - Pasar a segundo plano CANCELA el intervalo (no se acumulan ticks perdidos)
 *   y volver a primer plano arranca un ciclo nuevo.
 * - Es frío: cada suscripción tiene su propio contador, y desuscribirse lo apaga.
 *   En los componentes se combina con `takeUntilDestroyed` para cortarlo al
 *   destruirse la página.
 */
export function pollVisibleTab(intervaloMs: number = POLL_INTERVAL_MS): Observable<number> {
  // Sin `document` (render en el servidor) no hay app que refrescar: un
  // intervalo en SSR solo generaría pedidos sin consumidor.
  if (typeof document === 'undefined') {
    return EMPTY;
  }

  return visibleTabChanges().pipe(switchMap((visible) => (visible ? interval(intervaloMs) : EMPTY)));
}
