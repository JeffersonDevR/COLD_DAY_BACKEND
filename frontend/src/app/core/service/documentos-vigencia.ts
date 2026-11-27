/**
 * Vigencia de un documento del expediente (técnico o proveedor), calculada en
 * el cliente a partir de su fecha de vencimiento. El backend solo guarda la
 * fecha y un `vigente` binario; el aviso de "por vencer" es de presentación.
 *
 * `DIAS_AVISO_VENCIMIENTO` es un valor por defecto mío, no una política de
 * producto confirmada.
 */
export type VigenciaDocumento = 'SIN_VENCIMIENTO' | 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';

/** Cuántos días antes del vencimiento se avisa. */
export const DIAS_AVISO_VENCIMIENTO = 30;

const MS_DIA = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` como fecha local a medianoche; `null` si no es una fecha válida. */
function aFechaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function vigenciaDocumento(fechaVencimiento: string | undefined, hoy: Date = new Date()): VigenciaDocumento {
  if (!fechaVencimiento) return 'SIN_VENCIMIENTO';
  const vence = aFechaLocal(fechaVencimiento);
  if (!vence) return 'SIN_VENCIMIENTO';

  // Un documento vence al terminar el día de su fecha: ese día todavía sirve.
  const dias = Math.round((vence.getTime() - inicioDelDia(hoy).getTime()) / MS_DIA);
  if (dias < 0) return 'VENCIDO';
  return dias <= DIAS_AVISO_VENCIMIENTO ? 'POR_VENCER' : 'VIGENTE';
}

export function etiquetaVigencia(vigencia: VigenciaDocumento): string {
  switch (vigencia) {
    case 'VENCIDO':
      return 'Vencido';
    case 'POR_VENCER':
      return 'Por vencer';
    case 'VIGENTE':
      return 'Vigente';
    case 'SIN_VENCIMIENTO':
      return 'Sin vencimiento';
  }
}

export interface ResumenVigencia {
  vencidos: number;
  porVencer: number;
}

/** Cuántos documentos están vencidos o por vencer, para el aviso de la pantalla. */
export function resumenVigencia(
  documentos: readonly { fechaVencimiento?: string }[],
  hoy: Date = new Date(),
): ResumenVigencia {
  let vencidos = 0;
  let porVencer = 0;
  for (const documento of documentos) {
    const vigencia = vigenciaDocumento(documento.fechaVencimiento, hoy);
    if (vigencia === 'VENCIDO') vencidos++;
    else if (vigencia === 'POR_VENCER') porVencer++;
  }
  return { vencidos, porVencer };
}
