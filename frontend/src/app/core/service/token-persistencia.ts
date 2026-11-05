import { InjectionToken } from '@angular/core';

/**
 * Puerto de persistencia del token para la app móvil.
 *
 * `TokenStorageService` es síncrono (localStorage) porque media app lo consulta
 * en el arranque. En nativo el WebView puede perder localStorage, así que la
 * app móvil espeja el token en Capacitor Preferences mediante este puerto; el
 * default (web) es `null` y no agrega ninguna dependencia al bundle web.
 */
export interface PersistenciaToken {
  /** Guarda el token, o lo borra con `null`. Fire-and-forget: nunca lanza. */
  guardar(token: string | null): void;
}

export const TOKEN_PERSISTENCIA = new InjectionToken<PersistenciaToken | null>(
  'TOKEN_PERSISTENCIA',
  { providedIn: 'root', factory: () => null },
);
