import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function run(isAuthenticated: boolean, decoded: unknown) {
  const router = { navigate: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: { isAuthenticated: () => isAuthenticated, getDashboardRouteForRole: () => '/panel' },
      },
      { provide: TokenStorageService, useValue: { getDecodedToken: () => decoded } },
      { provide: Router, useValue: router },
    ],
  });
  const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
  return { result, router };
}

describe('guestGuard', () => {
  it('deja pasar al invitado sin sesión', () => {
    expect(run(false, null).result).toBe(true);
  });

  it('redirige al panel si ya hay sesión', () => {
    const { result, router } = run(true, { rol: 'CLIENTE' });
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('deja pasar si está autenticado pero sin token decodificado', () => {
    expect(run(true, null).result).toBe(true);
  });
});
