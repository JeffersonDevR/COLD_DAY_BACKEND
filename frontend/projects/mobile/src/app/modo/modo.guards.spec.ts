import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '@core/service/auth.service';
import { ModoApp } from './modo';
import { ModoService } from './modo.service';
import { authGuardMobile, modoActualGuard, modoGuard } from './modo.guards';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function urlTree(cmds: unknown[]) {
  return { cmds };
}

function setup(opts: { roles?: ModoApp[]; autenticado?: boolean; modoActual?: ModoApp | null }) {
  const router = { createUrlTree: vi.fn((cmds: unknown[]) => urlTree(cmds)) };
  const auth = { isAuthenticated: () => opts.autenticado ?? true };
  const modos = {
    disponible: (modo: ModoApp) => (opts.roles ?? []).includes(modo),
    homeActual: () => (opts.modoActual ? `/${opts.modoActual.toLowerCase()}` : null),
    modoActual: () => opts.modoActual ?? null,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: router },
      { provide: AuthService, useValue: auth },
      { provide: ModoService, useValue: modos },
    ],
  });
  return { router };
}

const run = (guard: (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown) =>
  TestBed.runInInjectionContext(() => guard(route, state));

describe('guards móviles', () => {
  it('authGuardMobile deja pasar con sesión', () => {
    setup({ autenticado: true });

    expect(run(authGuardMobile)).toBe(true);
  });

  it('authGuardMobile manda al login sin token', () => {
    const { router } = setup({ autenticado: false });

    expect(run(authGuardMobile)).toEqual(urlTree(['/login']));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('modoGuard deja pasar al modo que la cuenta tiene', () => {
    setup({ roles: ['CLIENTE', 'TECNICO'], modoActual: 'CLIENTE' });

    expect(run(modoGuard('TECNICO'))).toBe(true);
  });

  it('modoGuard devuelve al home del modo actual cuando el modo no está disponible', () => {
    const { router } = setup({ roles: ['CLIENTE'], modoActual: 'CLIENTE' });

    expect(run(modoGuard('PROVEEDOR'))).toEqual(urlTree(['/cliente']));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/cliente']);
  });

  it('modoGuard manda a "usá la web" cuando la cuenta no tiene ningún modo móvil', () => {
    setup({ roles: [], modoActual: null });

    expect(run(modoGuard('CLIENTE'))).toEqual(urlTree(['/solo-web']));
  });

  it('modoActualGuard exige al menos un modo móvil', () => {
    setup({ roles: ['CLIENTE'], modoActual: 'CLIENTE' });
    expect(run(modoActualGuard)).toBe(true);
  });

  it('modoActualGuard manda a "usá la web" para una cuenta de gestión', () => {
    setup({ roles: [], modoActual: null });

    expect(run(modoActualGuard)).toEqual(urlTree(['/solo-web']));
  });
});
