import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { mensajeErrorAccion } from '@core/alertas/mensaje-error';
import { ApiError } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { MobileToastService } from './toast.service';

/** Endpoints de autenticación: un 401 acá son credenciales, no sesión vencida. */
const AUTH_ENDPOINTS = /\/usuarios\/(login|recuperar-contrasena|reset-contrasena)/;

/**
 * Altas públicas de A2: el 400/409 lo explica el formulario con su copy por rol
 * (p. ej. qué campo único chocó). El interceptor se calla para no duplicar el
 * aviso; la pantalla igual notifica el fallo con su toast.
 */
const ALTA_ENDPOINTS = /\/api\/(clientes|tecnicos|proveedores)$/;

const MENSAJE_SIN_DETALLE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/**
 * Normaliza la respuesta de error del backend al mismo `ApiHttpError` que usa
 * la web, para que el copy (`mensajeErrorAccion`) y la marca
 * `sesionNotificada` viajen igual en ambas apps.
 */
export function normalizarErrorMobile(err: unknown): ApiHttpError | Error {
  if (!(err instanceof HttpErrorResponse)) {
    return err instanceof Error ? err : new Error(MENSAJE_SIN_DETALLE);
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

  return new ApiHttpError(MENSAJE_SIN_DETALLE, err.status);
}

/**
 * Errores HTTP de la app móvil.
 *
 * - 401 con sesión activa: avisa UNA vez ("Tu sesión expiró"), marca el error
 *   como notificado y cierra la sesión. Las páginas no repiten el aviso.
 * - 0 / 5xx: mensaje amable de conexión o servidor.
 * - 4xx: copy mapeado por status (`mensajeErrorAccion`).
 * - Login: el 401 son credenciales incorrectas y lo explica la pantalla, no el
 *   interceptor (evita el doble aviso).
 *
 * El error normalizado siempre se propaga al llamador; el interceptor nunca
 * lanza por su cuenta.
 */
export const mobileErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(MobileToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      const normalizado = normalizarErrorMobile(err);
      if (!(normalizado instanceof ApiHttpError)) {
        return throwError(() => normalizado);
      }

      const esAuth = AUTH_ENDPOINTS.test(req.url);
      // Login y altas explican su propio fallo: un único aviso por error.
      if (esAuth || ALTA_ENDPOINTS.test(req.url)) {
        return throwError(() => normalizado);
      }

      if (normalizado.status === 401 && auth.isAuthenticated()) {
        normalizado.sesionNotificada = true;
        void toast.warning('Tu sesión expiró', 'Ingresá de nuevo para continuar.');
        auth.logout();
      } else if (normalizado.status === 0) {
        void toast.error('Sin conexión', mensajeErrorAccion(normalizado));
      } else if (normalizado.status >= 500) {
        void toast.error('Error del servidor', mensajeErrorAccion(normalizado));
      } else if (normalizado.status >= 400) {
        void toast.error('No pudimos completar la acción', mensajeErrorAccion(normalizado));
      }

      return throwError(() => normalizado);
    }),
  );
};
