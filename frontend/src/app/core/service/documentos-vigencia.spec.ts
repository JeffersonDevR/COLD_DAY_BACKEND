import { describe, expect, it } from 'vitest';
import {
  DIAS_AVISO_VENCIMIENTO,
  etiquetaVigencia,
  resumenVigencia,
  vigenciaDocumento,
} from './documentos-vigencia';

const HOY = new Date(2026, 10, 25); // 25-nov-2026, hora local

describe('vigenciaDocumento', () => {
  it('sin fecha de vencimiento no vence nunca', () => {
    expect(vigenciaDocumento(undefined, HOY)).toBe('SIN_VENCIMIENTO');
    expect(vigenciaDocumento('', HOY)).toBe('SIN_VENCIMIENTO');
  });

  it('una fecha pasada está vencida', () => {
    expect(vigenciaDocumento('2026-11-24', HOY)).toBe('VENCIDO');
  });

  it('el mismo día del vencimiento todavía está vigente: vence al terminar el día', () => {
    expect(vigenciaDocumento('2026-11-25', HOY)).toBe('POR_VENCER');
  });

  it('dentro de la ventana de aviso está por vencer', () => {
    expect(vigenciaDocumento('2026-12-25', HOY)).toBe('POR_VENCER');
  });

  it('pasada la ventana de aviso está vigente', () => {
    expect(vigenciaDocumento('2026-12-26', HOY)).toBe('VIGENTE');
    expect(DIAS_AVISO_VENCIMIENTO).toBe(30);
  });

  it('una fecha inválida no se da por vigente: se trata como sin vencimiento conocido', () => {
    expect(vigenciaDocumento('no-es-fecha', HOY)).toBe('SIN_VENCIMIENTO');
  });
});

describe('resumenVigencia', () => {
  it('cuenta los vencidos y los por vencer', () => {
    const resumen = resumenVigencia(
      [
        { fechaVencimiento: '2026-11-01' },
        { fechaVencimiento: '2026-11-30' },
        { fechaVencimiento: '2027-06-01' },
        { fechaVencimiento: undefined },
      ],
      HOY,
    );

    expect(resumen).toEqual({ vencidos: 1, porVencer: 1 });
  });
});

describe('etiquetaVigencia', () => {
  it('da un texto corto por estado', () => {
    expect(etiquetaVigencia('VENCIDO')).toBe('Vencido');
    expect(etiquetaVigencia('POR_VENCER')).toBe('Por vencer');
    expect(etiquetaVigencia('VIGENTE')).toBe('Vigente');
    expect(etiquetaVigencia('SIN_VENCIMIENTO')).toBe('Sin vencimiento');
  });
});
