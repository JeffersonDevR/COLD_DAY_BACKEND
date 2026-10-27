import { ApiHttpError } from '../interceptos/error.interceptor';

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
