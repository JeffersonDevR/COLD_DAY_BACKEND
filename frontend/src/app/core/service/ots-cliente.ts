import { OtResponse } from '../models/common.models';

/**
 * Vistas del listado de OTs del cliente (web A4 y móvil A4).
 *
 * Vive en `core` porque las dos apps muestran la misma lista con los mismos
 * filtros: una regla duplicada es una regla que se desincroniza en silencio.
 */
export type FiltroOts = 'TODAS' | 'ACTIVAS' | 'COMPLETADAS' | 'SIN_TECNICO';

/** Textos del encabezado y del estado vacío para cada vista. */
export interface TextoFiltro {
  subtitulo: string;
  tituloVacio: string;
  descripcionVacio: string;
}

/** Estados que ya no son trabajo pendiente para el cliente. */
const ESTADOS_CERRADOS: readonly string[] = ['FINALIZADA', 'CANCELADA'];

/** Una OT sigue activa mientras el cliente todavía espera algo de ella. */
export function esOtActiva(ot: OtResponse): boolean {
  return !ESTADOS_CERRADOS.includes(ot.estado);
}

/** Una OT completada es la que terminó el servicio (la cancelada no cuenta). */
export function esOtFinalizada(ot: OtResponse): boolean {
  return ot.estado === 'FINALIZADA';
}

/** Una OT espera técnico cuando nadie la tomó todavía y no está cancelada. */
export function esOtSinTecnico(ot: OtResponse): boolean {
  return !ot.tecnicoId && ot.estado !== 'CANCELADA';
}

/**
 * Predicado de cada vista. `TODAS` incluye también las canceladas: es la única
 * vista donde aparecen.
 */
export const PREDICADOS_FILTRO_OTS: Readonly<Record<FiltroOts, (ot: OtResponse) => boolean>> = {
  TODAS: () => true,
  ACTIVAS: esOtActiva,
  COMPLETADAS: esOtFinalizada,
  SIN_TECNICO: esOtSinTecnico,
};

/** Lista visible según el filtro. Los contadores NO dependen de ella. */
export function filtrarOts(ots: readonly OtResponse[], filtro: FiltroOts): OtResponse[] {
  return ots.filter(PREDICADOS_FILTRO_OTS[filtro]);
}

/** Servicios en proceso: el contador que resume el panel. */
export function contarOtsActivas(ots: readonly OtResponse[]): number {
  return ots.filter(esOtActiva).length;
}

/** Servicios concluidos: el contador que resume el panel. */
export function contarOtsFinalizadas(ots: readonly OtResponse[]): number {
  return ots.filter(esOtFinalizada).length;
}

/** Etiqueta del control segmentado, en el orden en que se muestra. */
export const OPCIONES_FILTRO_OTS: readonly { valor: FiltroOts; etiqueta: string }[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'ACTIVAS', etiqueta: 'Activas' },
  { valor: 'COMPLETADAS', etiqueta: 'Completadas' },
  { valor: 'SIN_TECNICO', etiqueta: 'Sin técnico' },
];

/**
 * Copy de cada vista. Está en voseo porque es lo que lee el cliente en las dos
 * apps: el subtítulo explica qué muestra la vista y el estado vacío dice qué
 * falta, sin inventar un listado que no existe.
 */
export const TEXTOS_FILTRO_OTS: Readonly<Record<FiltroOts, TextoFiltro>> = {
  TODAS: {
    subtitulo: 'Todas tus órdenes de trabajo, incluidas las canceladas',
    tituloVacio: 'Todavía no pediste un servicio',
    descripcionVacio:
      'Cuando pidas asistencia técnica para tus aires o electrodomésticos, vas a ver acá el avance de cada orden.',
  },
  ACTIVAS: {
    subtitulo: 'Trazabilidad en tiempo real y asignación perimetral',
    tituloVacio: 'No tenés servicios en curso',
    descripcionVacio:
      'Todos tus requerimientos técnicos están al día. Si necesitás asistencia para tus aires o electrodomésticos, pedí uno nuevo.',
  },
  COMPLETADAS: {
    subtitulo: 'Órdenes ya finalizadas, con su acta de garantía',
    tituloVacio: 'Todavía no tenés servicios completados',
    descripcionVacio:
      'Cuando un técnico termine un servicio, quedará listado acá con su garantía certificada.',
  },
  SIN_TECNICO: {
    subtitulo: 'Órdenes que todavía esperan la asignación de un técnico',
    tituloVacio: 'No tenés servicios esperando técnico',
    descripcionVacio: 'Todas tus órdenes ya tienen un técnico asignado o están cerradas.',
  },
};
