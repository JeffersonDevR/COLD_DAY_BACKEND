import { EstadoOt, OtResponse } from '@core/models/common.models';
import { ETIQUETA_ESTADO_OT } from '@core/service/estado-ot';
import { AccionOt, accionOtCliente, tituloEstadoOt } from './orden-reglas';

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'ASIGNADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

describe('accionOtCliente', () => {
  it.each<[string, Partial<OtResponse>, AccionOt]>([
    ['asignada sin pagar', { estado: 'ASIGNADA', visitaPagada: false }, 'pagar-visita'],
    ['asignada sin dato de pago', { estado: 'ASIGNADA' }, null],
    ['en disputa', { estado: 'DISPUTADA' }, 'pagar-visita'],
    ['cancelada', { estado: 'CANCELADA' }, 'pagar-visita'],
    ['con diagnóstico', { estado: 'EN_DIAGNOSTICO', diagnostico: {} as never }, 'presupuesto'],
    ['diagnóstico sin registrar', { estado: 'EN_DIAGNOSTICO' }, null],
    ['finalizada', { estado: 'FINALIZADA' }, 'acta'],
    ['solicitada', { estado: 'SOLICITADA' }, null],
    ['buscando', { estado: 'BUSCANDO_TECNICO' }, null],
  ])('%s', (_caso, datos, esperado) => {
    expect(accionOtCliente(ot(datos))).toBe(esperado);
  });
});

describe('tituloEstadoOt', () => {
  it.each<EstadoOt>(['SOLICITADA', 'BUSCANDO_TECNICO'])('%s dice que está buscando', (estado) => {
    expect(tituloEstadoOt(ot({ estado }))).toBe('Buscando técnico');
  });

  it.each<EstadoOt>(['ASIGNADA', 'EN_CAMINO'])('%s con llegada dice que llegó', (estado) => {
    expect(tituloEstadoOt(ot({ estado, llegadaEn: '2026-11-27T10:00:00Z' }))).toBe(
      'El técnico llegó',
    );
  });

  it('desde el diagnóstico dice el estado aunque haya llegada', () => {
    expect(
      tituloEstadoOt(ot({ estado: 'EN_DIAGNOSTICO', llegadaEn: '2026-11-27T10:00:00Z' })),
    ).toBe(ETIQUETA_ESTADO_OT.EN_DIAGNOSTICO);
  });

  it.each<EstadoOt>(['ASIGNADA', 'EN_CAMINO', 'FINALIZADA', 'DISPUTADA', 'CANCELADA'])(
    '%s sin llegada usa su etiqueta',
    (estado) => {
      expect(tituloEstadoOt(ot({ estado }))).toBe(ETIQUETA_ESTADO_OT[estado]);
    },
  );
});
