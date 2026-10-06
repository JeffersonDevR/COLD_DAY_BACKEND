import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { TokenStorageService } from './service/token-storage.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (authService.isAuthenticated() || tokenStorage.getDecodedToken()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
