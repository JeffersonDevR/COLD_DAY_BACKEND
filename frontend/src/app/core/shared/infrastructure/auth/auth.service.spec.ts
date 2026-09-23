import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from '../../presentation/toast.service';
import { Rol, UsuarioResponse } from '../../domain/models/common.models';

const TOKEN_KEY = 'coldday.token';

function tokenWith(payload: Record<string, unknown>): string {
  return `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.signature`;
}

function expEn(segundos: number): number {
  return Math.floor(Date.now() / 1000) + segundos;
}

const adminUser: UsuarioResponse = {
  id: 1,
  nombre: 'Carlos Méndez',
  correo: 'carlos.admin@coldday.com.co',
  rol: 'ADMINISTRADOR',
  habeasDataAceptado: true,
  activo: true,
};

describe('AuthService', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toast: { warning: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    window.localStorage.clear();
    router = { navigate: vi.fn() };
    toast = { warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const create = (): AuthService => TestBed.inject(AuthService);

  it('sin token no está autenticado', () => {
    const service = create();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.userRole()).toBeNull();
  });

  it('restaura la sesión desde un JWT válido', () => {
    window.localStorage.setItem(
      TOKEN_KEY,
      tokenWith({ sub: '5', rol: 'CLIENTE', nombre: 'Luis', correo: 'l@x.co', exp: expEn(3600) }),
    );
    const service = create();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe(5);
    expect(service.currentUser()?.nombre).toBe('Luis');
    expect(service.userRole()).toBe('CLIENTE');
  });

  it('descarta un token expirado', () => {
    window.localStorage.setItem(TOKEN_KEY, tokenWith({ sub: '5', rol: 'CLIENTE', exp: expEn(-10) }));
    const service = create();
    expect(service.isAuthenticated()).toBe(false);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('descarta un token sin rol', () => {
    window.localStorage.setItem(TOKEN_KEY, tokenWith({ sub: '5', exp: expEn(3600) }));
    const service = create();
    expect(service.currentUser()).toBeNull();
  });

  it('setCurrentUser guarda token y usuario', () => {
    const service = create();
    service.setCurrentUser(adminUser);
    expect(service.currentUser()?.rol).toBe('ADMINISTRADOR');
    expect(service.isAuthenticated()).toBe(true);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeTruthy();
  });

  it('setCurrentUser acepta un token externo', () => {
    const service = create();
    service.setCurrentUser(adminUser, 'externo.token.aqui');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('externo.token.aqui');
  });

  it('establecerSesionDesdeToken reconstruye el perfil desde el JWT', () => {
    const service = create();
    const usuario = service.establecerSesionDesdeToken(
      { token: tokenWith({ sub: '9', rol: 'TECNICO', exp: expEn(3600) }), expiracion: '', rol: 'TECNICO' },
      'tecnico@x.co',
    );
    expect(usuario.id).toBe(9);
    expect(usuario.correo).toBe('tecnico@x.co');
    expect(usuario.nombre).toBe('tecnico@x.co');
    expect(usuario.rol).toBe('TECNICO');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('establecerSesionDesdeToken usa el usuario completo si se entrega', () => {
    const service = create();
    const usuario = service.establecerSesionDesdeToken(
      { token: tokenWith({ sub: '9', rol: 'TECNICO', exp: expEn(3600) }), expiracion: '', rol: 'TECNICO' },
      'ignorado@x.co',
      adminUser,
    );
    expect(usuario).toBe(adminUser);
  });

  it('logout limpia la sesión y navega al login', () => {
    const service = create();
    service.setCurrentUser(adminUser);
    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('switchDemoRole cambia el perfil demo', () => {
    const service = create();
    service.switchDemoRole('TECNICO');
    expect(service.currentUser()?.rol).toBe('TECNICO');
    expect(service.currentUser()?.id).toBe(6);
  });

  it('switchDemoRole con rol desconocido cae en CLIENTE', () => {
    const service = create();
    service.switchDemoRole('DESCONOCIDO' as unknown as Rol);
    expect(service.currentUser()?.rol).toBe('CLIENTE');
  });

  it('getDashboardRouteForRole resuelve la ruta por rol', () => {
    const service = create();
    expect(service.getDashboardRouteForRole('CLIENTE')).toBe('/panel');
    expect(service.getDashboardRouteForRole('TECNICO')).toBe('/tecnico/ofertas');
    expect(service.getDashboardRouteForRole('ADMINISTRADOR')).toBe('/admin/dashboard');
    expect(service.getDashboardRouteForRole('CONTABLE')).toBe('/admin/dashboard');
    expect(service.getDashboardRouteForRole('OTRO' as unknown as Rol)).toBe('/login');
  });

  it('expira la sesión al vencer el JWT', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    window.localStorage.setItem(TOKEN_KEY, tokenWith({ sub: '5', rol: 'CLIENTE', exp: expEn(2) }));
    const service = create();
    expect(service.isAuthenticated()).toBe(true);

    vi.advanceTimersByTime(2100);

    expect(toast.warning).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
