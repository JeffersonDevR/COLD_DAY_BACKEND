import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { ApiHttpError, errorInterceptor } from './error.interceptor';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../presentation/toast.service';

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

  it('cierra sesión ante 401 en un endpoint protegido', async () => {
    const error = new HttpErrorResponse({ status: 401, error: null, url: '/api/ot' });
    const { promise, auth, toast } = run('/api/ot', error, true);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect(toast.warning).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });

  it('no cierra sesión ante 401 en el login', async () => {
    const error = new HttpErrorResponse({ status: 401, error: null, url: '/api/usuarios/login' });
    const { promise, auth } = run('/api/usuarios/login', error, true);
    const caught = await capture(promise);
    expect(caught).toBeInstanceOf(ApiHttpError);
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
