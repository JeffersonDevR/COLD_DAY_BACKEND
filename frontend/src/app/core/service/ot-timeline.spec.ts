import { calcularPasosTimeline, ORDEN_TIMELINE } from './ot-timeline';

describe('calcularPasosTimeline', () => {
  it('devuelve los siete pasos en el orden operativo', () => {
    const pasos = calcularPasosTimeline('SOLICITADA');

    expect(pasos.map((p) => p.estado)).toEqual([...ORDEN_TIMELINE]);
    expect(pasos).toHaveLength(7);
  });

  it('SOLICITADA completa solo el primer paso', () => {
    const pasos = calcularPasosTimeline('SOLICITADA');

    expect(pasos[0].isCompleted).toBe(true);
    expect(pasos[0].isCurrent).toBe(true);
    expect(pasos.slice(1).every((p) => !p.isCompleted)).toBe(true);
  });

  it('EN_CAMINO completa hasta su índice y marca el actual', () => {
    const pasos = calcularPasosTimeline('EN_CAMINO');

    expect(pasos.find((p) => p.estado === 'ASIGNADA')?.isCompleted).toBe(true);
    expect(pasos.find((p) => p.estado === 'EN_CAMINO')?.isCurrent).toBe(true);
    expect(pasos.find((p) => p.estado === 'EN_REPARACION')?.isCompleted).toBe(false);
  });

  it('FINALIZADA completa todo el ciclo', () => {
    const pasos = calcularPasosTimeline('FINALIZADA');

    expect(pasos.every((p) => p.isCompleted)).toBe(true);
    expect(pasos.find((p) => p.estado === 'FINALIZADA')?.isCurrent).toBe(true);
  });

  it('un estado fuera del ciclo feliz no avanza por él', () => {
    // CANCELADA / DISPUTADA / SIN_TECNICOS_DISPONIBLES no están en el orden:
    // ningún paso queda completado ni marcado como actual (contrato web).
    for (const estado of ['CANCELADA', 'DISPUTADA', 'SIN_TECNICOS_DISPONIBLES'] as const) {
      const pasos = calcularPasosTimeline(estado);

      expect(pasos.every((p) => !p.isCompleted && !p.isCurrent)).toBe(true);
    }
  });
});
