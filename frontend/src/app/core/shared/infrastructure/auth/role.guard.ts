import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { Rol } from '../../domain/models/common.models';

export const roleGuard = (expectedRoles: Rol[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const tokenStorage = inject(TokenStorageService);
    const router = inject(Router);

    const decoded = tokenStorage.getDecodedToken();
    const currentRole = authService.userRole() ?? decoded?.rol;

    if (!currentRole) {
      router.navigate(['/login']);
      return false;
    }

    if (expectedRoles.includes(currentRole)) {
      return true;
    }

    // Rol no autorizado -> redirigir a su panel
    const safeRoute = authService.getDashboardRouteForRole(currentRole);
    router.navigate([safeRoute]);
    return false;
  };
};
