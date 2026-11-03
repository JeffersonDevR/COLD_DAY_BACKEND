import { InjectionToken } from '@angular/core';

/**
 * Puerto de avisos de sesión que consume `AuthService`.
 *
 * La capa compartida no puede depender de la UI: la web avisa con el toast de
 * PrimeNG y la app móvil con un toast de Ionic. Cada aplicación provee su
 * adaptador en `app.config.ts`.
 */
export interface AvisoSesion {
  advertir(titulo: string, mensaje?: string): void;
}

/** Adaptador por defecto: una app sin avisos configurados no rompe la sesión. */
export const AVISO_SESION_NOOP: AvisoSesion = {
  advertir: () => {
    // Sin UI de avisos: el cierre de sesión sigue su curso.
  },
};

/**
 * Token de inyección con default no-op, para que `AuthService` funcione en
 * tests aislados y en cualquier host que no registre un adaptador.
 */
export const AVISO_SESION = new InjectionToken<AvisoSesion>('AVISO_SESION', {
  providedIn: 'root',
  factory: (): AvisoSesion => AVISO_SESION_NOOP,
});
