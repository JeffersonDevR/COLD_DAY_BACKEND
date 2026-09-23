import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function run(isAuthenticated: boolean, decoded: unknown) {
  const router = { navigate: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
      { provide: TokenStorageService, useValue: { getDecodedToken: () => decoded } },
      { provide: Router, useValue: router },
    ],
  });
  const result = TestBed.runInInjectionContext(() => authGuard(route, state));
  return { result, router };
}

describe('authGuard', () => {
  it('permite el paso si el usuario está autenticado', () => {
    expect(run(true, null).result).toBe(true);
  });

  it('permite el paso si hay token decodificado', () => {
    expect(run(false, { rol: 'CLIENTE' }).result).toBe(true);
  });

  it('redirige al login cuando no hay sesión', () => {
    const { result, router } = run(false, null);
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
