import { OtResponse } from '@core/models/common.models';
import { ETIQUETA_ESTADO_OT } from '@core/service/estado-ot';

/** Lo que el cliente tiene que hacer con una orden. */
export type AccionOt = 'pagar-visita' | 'presupuesto' | 'acta' | null;

/** Pagar una cancelada o disputada reabre el despacho; una asignada habilita el desplazamiento. */
export function puedePagarVisita(ot: OtResponse): boolean {
  if (ot.estado === 'CANCELADA' || ot.estado === 'DISPUTADA') return true;
  return ot.estado === 'ASIGNADA' && ot.visitaPagada === false;
}

export function accionOtCliente(ot: OtResponse): AccionOt {
  if (puedePagarVisita(ot)) return 'pagar-visita';
  if (ot.estado === 'EN_DIAGNOSTICO' && ot.diagnostico) return 'presupuesto';
  return ot.estado === 'FINALIZADA' ? 'acta' : null;
}

/** El dato grande de la orden: lo primero que se lee. */
export function tituloEstadoOt(ot: OtResponse): string {
  if (ot.estado === 'SOLICITADA' || ot.estado === 'BUSCANDO_TECNICO') return 'Buscando técnico';
  // Desde el diagnóstico la llegada es noticia vieja: se dice el estado.
  if (ot.llegadaEn && (ot.estado === 'ASIGNADA' || ot.estado === 'EN_CAMINO')) {
    return 'El técnico llegó';
  }
  return ETIQUETA_ESTADO_OT[ot.estado];
}
