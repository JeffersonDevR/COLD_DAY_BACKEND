import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { TokenStorageService } from './service/token-storage.service';
import { Rol } from './models/common.models';

export const roleGuard = (expectedRoles: Rol[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const tokenStorage = inject(TokenStorageService);
    const router = inject(Router);

    const decoded = tokenStorage.getDecodedToken();
    // Autoriza por PERTENENCIA al conjunto: un usuario dual (Cliente + Técnico)
    // pasa tanto una ruta de Cliente como una de Técnico. Respaldo al token
    // cuando el servicio aún no tiene sesión materializada.
    const roles = authService.userRoles();
    const effective = roles.size > 0
      ? roles
      : new Set<Rol>(decoded?.roles?.length ? decoded.roles : decoded?.rol ? [decoded.rol] : []);

    if (effective.size === 0) {
      router.navigate(['/login']);
      return false;
    }

    if (expectedRoles.some((rol) => effective.has(rol))) {
      return true;
    }

    // Ningún rol del conjunto está autorizado -> redirigir a su panel primario.
    const primaryRole = authService.userRole() ?? decoded?.rol ?? [...effective][0];
    const safeRoute = authService.getDashboardRouteForRole(primaryRole);
    router.navigate([safeRoute]);
    return false;
  };
};
