import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import { MobileToastService } from './toast.service';
import { mobileErrorInterceptor, normalizarErrorMobile } from './mobile-error.interceptor';

function setup(auth: { isAuthenticated: boolean }) {
  const toast = { error: vi.fn(), warning: vi.fn() };
  const authService = { isAuthenticated: () => auth.isAuthenticated, logout: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: MobileToastService, useValue: toast },
      { provide: AuthService, useValue: authService },
    ],
  });
  return { toast, authService };
}

async function run(url: string, error: unknown, autenticado = true) {
  const { toast, authService } = setup({ isAuthenticated: autenticado });
  const req = new HttpRequest('GET', url);
  const next: HttpHandlerFn = () => throwError(() => error);
  const promise = TestBed.runInInjectionContext(() =>
    firstValueFrom(mobileErrorInterceptor(req, next)),
  );
  try {
    await promise;
    throw new Error('se esperaba un rechazo');
  } catch (err) {
    return { caught: err, toast, authService };
  }
}

describe('mobileErrorInterceptor', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('normaliza el ApiError del backend con fieldErrors', () => {
    const err = normalizarErrorMobile(
      new HttpErrorResponse({
        status: 400,
        error: { status: 400, message: 'Datos inválidos', fieldErrors: ['correo'] },
      }),
    );

    expect(err).toBeInstanceOf(ApiHttpError);
    expect((err as ApiHttpError).message).toBe('Datos inválidos (correo)');
    expect((err as ApiHttpError).fieldErrors).toEqual(['correo']);
  });

  it('401 con sesión: avisa una vez, marca el error y cierra sesión', async () => {
    const { caught, toast, authService } = await run(
      '/api/ots',
      new HttpErrorResponse({ status: 401, error: { status: 401, message: 'No autorizado' } }),
    );

    expect(caught).toBeInstanceOf(ApiHttpError);
    expect((caught as ApiHttpError).sesionNotificada).toBe(true);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith('Tu sesión expiró', expect.any(String));
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('no cierra sesión en un 401 sin sesión', async () => {
    const { toast, authService } = await run(
      '/api/ots',
      new HttpErrorResponse({ status: 401 }),
      false,
    );

    expect(authService.logout).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('5xx: muestra el copy de error del servidor', async () => {
    const { caught, toast } = await run('/api/ots', new HttpErrorResponse({ status: 500 }));

    expect(caught).toBeInstanceOf(ApiHttpError);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [titulo, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(titulo).toBe('Error del servidor');
    expect(mensaje).toContain('error en el servidor');
  });

  it('status 0: muestra el copy de conexión', async () => {
    const { toast } = await run('/api/ots', new HttpErrorResponse({ status: 0 }));

    expect(toast.error).toHaveBeenCalledTimes(1);
    const [, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(mensaje).toContain('conectar con el servidor');
  });

  it('4xx: traduce la acción con el copy por status', async () => {
    const { toast } = await run('/api/ots', new HttpErrorResponse({ status: 403 }));

    const [titulo, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(titulo).toBe('No pudimos completar la acción');
    expect(mensaje).toContain('permisos');
  });

  it('el login explica su propio 401: el interceptor no avisa', async () => {
    const { toast, authService } = await run(
      '/api/usuarios/login',
      new HttpErrorResponse({ status: 401 }),
    );

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('las altas de A2 explican su propio 409: el interceptor no avisa', async () => {
    for (const url of ['/api/clientes', '/api/tecnicos', '/api/proveedores']) {
      TestBed.resetTestingModule();
      const { caught, toast } = await run(url, new HttpErrorResponse({ status: 409 }));

      expect(caught).toBeInstanceOf(ApiHttpError);
      expect((caught as ApiHttpError).status).toBe(409);
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    }
  });

  it('las acciones de A5 con copy propio no reciben un toast genérico', async () => {
    const urls = [
      'http://api.test/api/ot',
      'http://api.test/api/clientes/perfil',
      'http://api.test/api/clientes/me/ubicacion',
      'http://api.test/api/config/maps',
      'http://api.test/api/maps/geocode',
    ];

    for (const url of urls) {
      TestBed.resetTestingModule();
      const { caught, toast } = await run(url, new HttpErrorResponse({ status: 500 }));

      expect(caught).toBeInstanceOf(ApiHttpError);
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    }
  });

  it('las subrutas hermanas de la OT sí avisan: el silencio no se propaga', async () => {
    const { toast } = await run(
      'http://api.test/api/ot/OT-1/cancelar',
      new HttpErrorResponse({ status: 409 }),
    );

    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('no convierte en toast un error que no es HTTP', async () => {
    const { caught, toast } = await run('/api/ots', new Error('boom'));

    expect(caught).toBeInstanceOf(Error);
    expect((caught as ApiHttpError).status).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
