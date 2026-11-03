import { ApiHttpError } from '../alertas/api-http.error';

/** Mensaje exacto que devuelve el backend (404) cuando el usuario no tiene perfil de cliente. */
const PATRON_PERFIL_CLIENTE_FALTANTE = /no existe un perfil de cliente/i;

/**
 * Detecta el rechazo por falta de perfil de cliente: el backend responde 404
 * (o 409 en variantes de validación) con ese mensaje, y el interceptor lo
 * entrega como ApiHttpError con el cuerpo ya mapeado.
 *
 * Es un caso de NEGOCIO, no una falla de carga: quien lo recibe debe ofrecer el
 * alta del perfil en vez de mostrar un error genérico.
 */
export function esErrorPerfilClienteFaltante(err: unknown): boolean {
  if (!(err instanceof ApiHttpError)) return false;
  if (err.status !== 404 && err.status !== 409) return false;
  return PATRON_PERFIL_CLIENTE_FALTANTE.test(err.message);
}

/**
 * Copy del 409 al adquirir el perfil (web y móvil comparten el mismo flujo de
 * un toque): el alta ya se commiteó antes (el token de reemplazo no llegó), así
 * que reintentar no ayuda. Hay que reautenticarse y el borrador sigue guardado.
 */
export const MENSAJE_PERFIL_CLIENTE_YA_EXISTE =
  'Tu perfil de cliente ya existe. Iniciá sesión para continuar; tu solicitud quedó guardada.';
