import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { ApiHttpError, errorInterceptor } from './error.interceptor';
import { AuthService } from '../service/auth.service';
import { ToastService } from '../alertas/toast.service';

function run(url: string, error: unknown, isAuthenticated = true) {
  const auth = { isAuthenticated: () => isAuthenticated, logout: vi.fn() };
  const toast = { warning: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  });
  const req = new HttpRequest('GET', url);
  const next: HttpHandlerFn = () => throwError(() => error);
  const promise = TestBed.runInInjectionContext(() => firstValueFrom(errorInterceptor(req, next)));
  return { promise, auth, toast };
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error('se esperaba un rechazo');
  } catch (err) {
    return err;
  }
}

describe('errorInterceptor', () => {
  it('normaliza el ApiError del backend con fieldErrors', async () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { status: 400, message: 'Datos inválidos', fieldErrors: ['correo', 'password'] },
      url: '/api/usuarios',
    });
    const { promise } = run('/api/usuarios', error);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect((caught as ApiHttpError).status).toBe(400);
    expect((caught as ApiHttpError).message).toBe('Datos inválidos (correo; password)');
    expect((caught as ApiHttpError).fieldErrors).toEqual(['correo', 'password']);
  });

  it('toma el primer elemento cuando el backend responde un array', async () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: [{ status: 403, message: 'Prohibido' }],
      url: '/api/x',
    });
    const { promise } = run('/api/x', error, false);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect((caught as ApiHttpError).status).toBe(403);
    expect((caught as ApiHttpError).message).toBe('Prohibido');
  });

  it('usa el mensaje de texto cuando el body es string', async () => {
    const error = new HttpErrorResponse({ status: 500, error: '  boom  ', url: '/api/x' });
    const { promise } = run('/api/x', error, false);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect((caught as ApiHttpError).message).toBe('boom');
  });

  it('aplica el mensaje por defecto según el status', async () => {
    const error = new HttpErrorResponse({ status: 0, error: null, url: '/api/x' });
    const { promise } = run('/api/x', error, false);
    const caught = await capture(promise);
    expect((caught as ApiHttpError).message).toBe(
      'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.',
    );
  });

  it('propaga errores que no son HTTP', async () => {
    const original = new Error('inesperado');
    const { promise } = run('/api/x', original, false);
    const caught = await capture(promise);
    expect(caught).toBe(original);
  });

  // Filtros resueltos: un status sin cuerpo legible jamás expone el mensaje
  // crudo de Angular (que incluye la URL) ni un código de status pelado.
  it('un status sin cuerpo legible responde copy neutra, no el mensaje crudo con la URL', async () => {
    const error = new HttpErrorResponse({ status: 500, error: null, url: 'http://backend.local/api/admin/metricas' });
    const { promise } = run('/api/admin/metricas', error, false);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect((caught as ApiHttpError).message).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect((caught as ApiHttpError).message).not.toContain('Http failure');
    expect((caught as ApiHttpError).message).not.toContain('backend.local');
  });

  it('cierra sesión ante 401 en un endpoint protegido', async () => {
    const error = new HttpErrorResponse({ status: 401, error: null, url: '/api/ot' });
    const { promise, auth, toast } = run('/api/ot', error, true);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(auth.logout).toHaveBeenCalled();
    // El error viaja marcado: la página que lo reciba no repite el aviso.
    expect((caught as ApiHttpError).sesionNotificada).toBe(true);
  });

  it('no cierra sesión ante 401 en el login', async () => {
    const error = new HttpErrorResponse({ status: 401, error: null, url: '/api/usuarios/login' });
    const { promise, auth } = run('/api/usuarios/login', error, true);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect(auth.logout).not.toHaveBeenCalled();
    // Sin aviso del interceptor, la página conserva su propio aviso.
    expect((caught as ApiHttpError).sesionNotificada).toBe(false);
  });

  it('un 401 sin sesión activa no marca el error como notificado', async () => {
    const error = new HttpErrorResponse({ status: 401, error: null, url: '/api/ot' });
    const { promise, auth, toast } = run('/api/ot', error, false);
    const caught = await capture(promise);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect((caught as ApiHttpError).sesionNotificada).toBe(false);
  });
});
