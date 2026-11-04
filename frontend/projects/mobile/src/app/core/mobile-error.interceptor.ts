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
 * Acciones cuya pantalla es la ÚNICA voz del fallo: ya muestran el error con su
 * copy (estado de error del panel, guía del perfil faltante, error inline del
 * formulario). El interceptor se calla para no duplicar el aviso con un toast
 * genérico encima del mensaje específico.
 *
 * Las rutas van ancladas al final para no silenciar subrutas hermanas. Las
 * subrutas de OT de pantallas que todavía no existen (p. ej. las acciones del
 * rol técnico) sí avisan: su única voz es el interceptor.
 */
const ACCION_SILENCIOSA_ENDPOINTS: readonly RegExp[] = [
  // Altas públicas de A2.
  /\/api\/(clientes|tecnicos|proveedores)$/,
  // Alta rápida del perfil de cliente (A5).
  /\/api\/clientes\/perfil$/,
  // Creación de la OT (A5).
  /\/api\/ot$/,
  // Listado del panel del cliente (A4).
  /\/api\/clientes\/me\/ots$/,
  // Ubicación del cliente: es telemetría del formulario y la página la ignora
  // a propósito (no debe bloquear la creación de la OT).
  /\/api\/clientes\/me\/ubicacion$/,
  // A6 — Seguimiento de OT: la pantalla es la única voz (banner con
  // Reintentar para la carga, toast propio para las acciones, silencio para
  // el sondeo y el stream).
  /\/api\/ot\/[^/]+$/,
  /\/api\/ot\/[^/]+\/tecnico-ubicacion$/,
  /\/api\/ot\/[^/]+\/cancelar$/,
  /\/api\/ot\/[^/]+\/pagar-visita$/,
  /\/api\/disputas\/ot\/[^/]+$/,
  /\/api\/sse\/ticket$/,
  // Maps: `MapsApi` resuelve con fallback local o `null`, y la pantalla cuenta
  // el resultado final. El error HTTP del proxy no es la última palabra.
  /\/api\/maps\//,
  // Configuración de mapas: el servicio tiene respaldo local y no es una
  // acción del usuario, así que un fallo acá no merece un toast.
  /\/api\/config\/maps$/,
];

function esAccionSilenciosa(url: string): boolean {
  return ACCION_SILENCIOSA_ENDPOINTS.some((patron) => patron.test(url));
}

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
 * - Acciones con copy propio (`ACCION_SILENCIOSA_ENDPOINTS`): el interceptor no
 *   avisa, pero el 401 con sesión activa sí cierra la sesión: una sesión vencida
 *   no es un error de negocio de la pantalla.
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

      // Login y recuperación explican su propio fallo: un único aviso por error.
      if (AUTH_ENDPOINTS.test(req.url)) {
        return throwError(() => normalizado);
      }

      if (normalizado.status === 401 && auth.isAuthenticated()) {
        normalizado.sesionNotificada = true;
        void toast.warning('Tu sesión expiró', 'Ingresá de nuevo para continuar.');
        auth.logout();
      } else if (esAccionSilenciosa(req.url)) {
        // La pantalla es la única voz: no se agrega un toast genérico encima.
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
