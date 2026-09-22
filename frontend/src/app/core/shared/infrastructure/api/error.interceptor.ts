import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../domain/models/common.models';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../presentation/toast.service';

/**
 * Error normalizado para la UI. Conserva el status HTTP y los `fieldErrors`
 * del backend para que las páginas puedan mostrar mensajes útiles.
 */
export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: string[] = [],
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

/**
 * Convierte la respuesta de error del backend (ApiError.java) en un Error con
 * mensaje legible.
 *
 * El backend devuelve `{status, message, fieldErrors}`; los handlers de seguridad
 * y el de Maps devuelven un ARRAY con un único ApiError.
 */
const MENSAJES_POR_STATUS: Record<number, string> = {
  [HttpStatusCode.Unauthorized]: 'Sesión inválida o expirada. Inicia sesión de nuevo.',
  [HttpStatusCode.Forbidden]: 'No tienes permisos para realizar esta acción.',
  0: 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.',
};

function mensajeFallback(err: HttpErrorResponse): string {
  return MENSAJES_POR_STATUS[err.status] || err.message || `Error ${err.status}`;
}

function normalizarError(err: unknown): ApiHttpError | Error {
  if (!(err instanceof HttpErrorResponse)) {
    return err instanceof Error ? err : new Error('Ocurrió un error inesperado');
  }

  const body = err.error as ApiError | ApiError[] | string | null | undefined;
  const apiError = Array.isArray(body) ? body[0] : body;

  if (apiError && typeof apiError === 'object' && 'message' in apiError && apiError.message) {
    const fieldErrors = apiError.fieldErrors ?? [];
    const detalle = fieldErrors.length ? ` (${fieldErrors.join('; ')})` : '';
    return new ApiHttpError(`${apiError.message}${detalle}`, err.status, fieldErrors);
  }

  if (typeof body === 'string' && body.trim()) {
    return new ApiHttpError(body.trim(), err.status);
  }

  return new ApiHttpError(mensajeFallback(err), err.status);
}

/** Endpoints de autenticación: un 401 aquí significa credenciales inválidas, no sesión expirada. */
const AUTH_ENDPOINTS = /\/usuarios\/(login|recuperar-contrasena|reset-contrasena)/;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err) => {
      const normalizado = normalizarError(err);

      // Sesión inválida/expirada: se limpia la sesión y se vuelve al login para
      // no seguir disparando peticiones que el backend rechaza con 401.
      if (
        normalizado instanceof ApiHttpError &&
        normalizado.status === HttpStatusCode.Unauthorized &&
        !AUTH_ENDPOINTS.test(req.url) &&
        auth.isAuthenticated()
      ) {
        toast.warning('Sesión expirada', 'Inicia sesión de nuevo para continuar.');
        auth.logout();
      }

      return throwError(() => normalizado);
    }),
  );
};
