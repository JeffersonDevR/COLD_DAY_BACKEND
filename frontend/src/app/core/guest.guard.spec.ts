import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, Router, RouterStateSnapshot } from '@angular/router';
import { guestGuard, recuperarGuard } from './guest.guard';
import { routes } from '../app.routes';
import { AuthService } from './service/auth.service';
import { TokenStorageService } from './service/token-storage.service';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function run(
  isAuthenticated: boolean,
  decoded: unknown,
  guard = guestGuard,
  snapshot: ActivatedRouteSnapshot = route,
) {
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
  const result = TestBed.runInInjectionContext(() => guard(snapshot, state));
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

describe('recuperarGuard', () => {
  it('es el guard de la ruta /recuperar', () => {
    expect(routes.find((r) => r.path === 'recuperar')?.canActivate).toEqual([recuperarGuard]);
  });

  const conQuery = (query: Record<string, string>) =>
    ({ queryParamMap: convertToParamMap(query) }) as ActivatedRouteSnapshot;

  it('deja pasar con sesión abierta si el enlace trae token', () => {
    const { result, router } = run(true, { rol: 'CLIENTE' }, recuperarGuard, conQuery({ token: 'abc' }));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sin token redirige al panel si ya hay sesión', () => {
    const { result, router } = run(true, { rol: 'CLIENTE' }, recuperarGuard, conQuery({}));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('con token vacío redirige igual que sin token', () => {
    expect(run(true, { rol: 'CLIENTE' }, recuperarGuard, conQuery({ token: '' })).result).toBe(false);
  });

  it('deja pasar al invitado sin token', () => {
    expect(run(false, null, recuperarGuard, conQuery({})).result).toBe(true);
  });
});
