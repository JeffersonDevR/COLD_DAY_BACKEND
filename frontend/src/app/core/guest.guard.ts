import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { TokenStorageService } from './service/token-storage.service';
import { Rol } from './models/common.models';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const decoded = tokenStorage.getDecodedToken();
  if (authService.isAuthenticated() && decoded) {
    const target = authService.getDashboardRouteForRole(decoded.rol as Rol);
    router.navigate([target]);
    return false;
  }

  return true;
};

/**
 * `/recuperar` con `?token=` es el enlace del correo: también debe abrir con
 * sesión (los usuarios de la app móvil no tienen otra pantalla para esto).
 */
export const recuperarGuard: CanActivateFn = (route, state) =>
  !!route.queryParamMap.get('token') || guestGuard(route, state);
