import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { Rol } from '../../domain/models/common.models';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function run(expected: Rol[], userRole: Rol | null, decoded: { rol?: Rol } | null) {
  const router = { navigate: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: { userRole: () => userRole, getDashboardRouteForRole: (rol: Rol) => `/panel-${rol}` },
      },
      { provide: TokenStorageService, useValue: { getDecodedToken: () => decoded } },
      { provide: Router, useValue: router },
    ],
  });
  const result = TestBed.runInInjectionContext(() => roleGuard(expected)(route, state));
  return { result, router };
}

describe('roleGuard', () => {
  it('sin rol redirige al login', () => {
    const { result, router } = run(['CLIENTE'], null, null);
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('permite el paso si el rol está autorizado', () => {
    expect(run(['ADMINISTRADOR', 'CONTABLE'], 'ADMINISTRADOR', null).result).toBe(true);
  });

  it('redirige al panel seguro si el rol no está autorizado', () => {
    const { result, router } = run(['ADMINISTRADOR'], 'CLIENTE', null);
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/panel-CLIENTE']);
  });

  it('usa el rol del token cuando userRole es null', () => {
    expect(run(['TECNICO'], null, { rol: 'TECNICO' }).result).toBe(true);
  });
});
