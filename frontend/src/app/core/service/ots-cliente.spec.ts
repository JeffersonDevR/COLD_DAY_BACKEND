import { describe, expect, it } from 'vitest';
import { EstadoOt, OtResponse } from '../models/common.models';
import {
  contarOtsActivas,
  esOtActiva,
  esOtSinTecnico,
  filtrarOts,
} from './ots-cliente';

function ot(estado: EstadoOt, over: Partial<OtResponse> = {}): OtResponse {
  return {
    id: `ot-${estado}`,
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría',
    estado,
    auxiliaresRequeridos: 0,
    tecnicoId: 'tec-1',
    ...over,
  };
}

describe('ots-cliente', () => {
  it.each<EstadoOt>(['SOLICITADA', 'BUSCANDO_TECNICO', 'ASIGNADA', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'DISPUTADA'])(
    '%s sigue activa: el cliente todavía espera algo',
    (estado) => {
      expect(esOtActiva(ot(estado))).toBe(true);
    },
  );

  it.each<EstadoOt>(['FINALIZADA', 'CANCELADA', 'SIN_TECNICOS_DISPONIBLES'])(
    '%s no está activa: el backend la da por terminada',
    (estado) => {
      expect(esOtActiva(ot(estado))).toBe(false);
    },
  );

  it('una OT sin técnicos disponibles no cuenta como "en proceso" ni sale en Activas', () => {
    const ots = [ot('EN_CAMINO'), ot('SIN_TECNICOS_DISPONIBLES', { tecnicoId: null })];

    expect(contarOtsActivas(ots)).toBe(1);
    expect(filtrarOts(ots, 'ACTIVAS').map((o) => o.estado)).toEqual(['EN_CAMINO']);
  });

  it('una OT sin técnicos disponibles sigue visible en Sin técnico y en Todas', () => {
    const sinTecnicos = ot('SIN_TECNICOS_DISPONIBLES', { tecnicoId: null });
    const ots = [ot('EN_CAMINO'), sinTecnicos];

    expect(esOtSinTecnico(sinTecnicos)).toBe(true);
    expect(filtrarOts(ots, 'SIN_TECNICO')).toEqual([sinTecnicos]);
    expect(filtrarOts(ots, 'TODAS')).toHaveLength(2);
  });

  it('una OT cancelada sin técnico no cuenta como esperando técnico', () => {
    expect(esOtSinTecnico(ot('CANCELADA', { tecnicoId: null }))).toBe(false);
  });
});
