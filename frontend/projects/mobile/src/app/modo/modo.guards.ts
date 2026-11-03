import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/service/auth.service';
import { ModoApp } from './modo';
import { ModoService } from './modo.service';

/** Sin token no hay app: de vuelta al login. */
export const authGuardMobile: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/**
 * GATE DE MODO (B15). Un usuario puede tener varios perfiles: el guard impide
 * entrar a un modo que su cuenta no tiene y lo devuelve al home del modo actual.
 *
 * Si no tiene ningún modo móvil (solo-admin), lo manda a la pantalla que explica
 * que el panel administrativo sigue en la web.
 */
export function modoGuard(modo: ModoApp): CanActivateFn {
  return () => {
    const modos = inject(ModoService);
    const router = inject(Router);
    if (modos.disponible(modo)) return true;
    return router.createUrlTree([modos.homeActual() ?? '/solo-web']);
  };
}

/** Rutas compartidas entre modos (p. ej. `/cuenta`): requieren al menos un modo. */
export const modoActualGuard: CanActivateFn = () => {
  const modos = inject(ModoService);
  const router = inject(Router);
  return modos.modoActual() ? true : router.createUrlTree(['/solo-web']);
};
