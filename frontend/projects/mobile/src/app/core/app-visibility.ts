import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Observable, fromEvent } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';
import { tabVisible } from '@core/service/visible-tab-polling';

/**
 * Visibilidad real de la app móvil.
 *
 * En Android/iOS el WebView no garantiza `visibilitychange` al pasar a segundo
 * plano (y menos al bloquear la pantalla). `App.addListener('appStateChange')`
 * es la señal del sistema: con esto los polls y el GPS se detienen de verdad
 * cuando la app no está en primer plano.
 *
 * En web (`ng serve mobile`) cae a `document.visibilityState`, igual que antes.
 */
export function visibilidadMovil(): Observable<boolean> {
  const porDocumento = fromEvent(document, 'visibilitychange').pipe(map(() => tabVisible()));

  if (!Capacitor.isNativePlatform()) {
    return porDocumento.pipe(startWith(tabVisible()), distinctUntilChanged(), shareReplay(1));
  }

  return new Observable<boolean>((subscriber) => {
    let activo = true;

    const escucha = App.addListener('appStateChange', ({ isActive }) => {
      if (activo) subscriber.next(isActive);
    });

    void App.getState()
      .then((estado) => {
        if (activo) subscriber.next(estado.isActive);
      })
      .catch(() => {
        if (activo) subscriber.next(true);
      });

    const suscripcionDom = porDocumento.subscribe((visible) => {
      if (activo) subscriber.next(visible);
    });

    return () => {
      activo = false;
      void escucha.then((handle) => handle.remove());
      suscripcionDom.unsubscribe();
    };
  }).pipe(distinctUntilChanged(), shareReplay(1));
}
