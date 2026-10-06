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
