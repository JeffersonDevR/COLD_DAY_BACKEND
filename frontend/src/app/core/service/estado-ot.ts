import { EstadoOt } from '../models/common.models';

/**
 * Atajos de presentación del estado de la OT (web y móvil).
 *
 * Una sola fuente para la etiqueta legible y el tono del chip: dos copias
 * divergen en silencio (la web ya tenía tres versiones del mismo mapa). El
 * tono es semántico, no un color por estado: ok | curso | espera | cerrada.
 */

/** Etiqueta del estado de la OT, la misma que usan los tableros. */
export const ETIQUETA_ESTADO_OT: Readonly<Record<EstadoOt, string>> = {
  SOLICITADA: 'Solicitada',
  BUSCANDO_TECNICO: 'Buscando técnico',
  ASIGNADA: 'Asignada',
  EN_CAMINO: 'En camino',
  EN_DIAGNOSTICO: 'En diagnóstico',
  EN_REPARACION: 'En reparación',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  SIN_TECNICOS_DISPONIBLES: 'Sin técnicos',
  DISPUTADA: 'En disputa',
};

/** Tono del chip de estado: un color por familia, no uno por estado. */
export type TonoEstadoOt = 'ok' | 'curso' | 'espera' | 'cerrada';

export function tonoEstadoOt(estado: EstadoOt): TonoEstadoOt {
  switch (estado) {
    case 'FINALIZADA':
      return 'ok';
    case 'CANCELADA':
    case 'DISPUTADA':
    case 'SIN_TECNICOS_DISPONIBLES':
      return 'cerrada';
    case 'SOLICITADA':
    case 'BUSCANDO_TECNICO':
      return 'espera';
    default:
      return 'curso';
  }
}
