import { ApiHttpError } from '../interceptos/error.interceptor';

/**
 * Copy humana para el fallo de una acción iniciada por el usuario. El status
 * HTTP se traduce a español: nunca se muestra el código crudo ni el mensaje
 * interno del backend (que puede traer ids de dominio o detalles técnicos).
 */
const MENSAJES_POR_STATUS: Record<number, string> = {
  0: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  400: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
  403: 'Tu cuenta no tiene permisos para realizar esta acción.',
  404: 'No encontramos el registro. Actualiza la página e inténtalo de nuevo.',
  409: 'La operación no se pudo completar porque el registro cambió de estado. Actualiza la página e inténtalo de nuevo.',
  500: 'Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.',
};

/** Fallback para status desconocidos o fallos que no son HTTP. */
const MENSAJE_INESPERADO = 'No se pudo completar la acción. Inténtalo de nuevo.';

/**
 * Traduce el error de una acción a un mensaje humano en español.
 *
 * `mensajes` permite sobrescribir el copy de un status concreto cuando la causa
 * real es conocida y genérica no sirve: p. ej. un 409 que aquí significa
 * "documentación vencida" (reintentar no ayuda) y no un conflicto de estado.
 */
export function mensajeErrorAccion(err: unknown, mensajes: Record<number, string> = {}): string {
  if (err instanceof ApiHttpError) {
    return mensajes[err.status] ?? MENSAJES_POR_STATUS[err.status] ?? MENSAJE_INESPERADO;
  }
  return MENSAJE_INESPERADO;
}
