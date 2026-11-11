import type { CategoriaServicio, EstadoOt, OtResponse } from '../models/common.models';
import { agruparEquipos, etiquetaCategoria } from './equipos-cliente';

/** Fixture mínimo: sólo los campos que el agrupado mira. */
function ot(over: Partial<OtResponse> & { categoriaServicio: CategoriaServicio }): OtResponse {
  return {
    id: 'ot-1',
    codigo: 'CD-0001',
    descripcionFalla: 'No enfría',
    estado: 'FINALIZADA' as EstadoOt,
    fechaCreacion: '2026-10-12T10:00:00Z',
    ...over,
  } as OtResponse;
}

describe('agruparEquipos', () => {
  it('devuelve una lista vacía si el cliente no tiene OTs', () => {
    expect(agruparEquipos([])).toEqual([]);
  });

  it('agrupa varias OTs de la misma categoría en un solo equipo', () => {
    const equipos = agruparEquipos([
      ot({ categoriaServicio: 'REFRIGERACION', id: 'a' }),
      ot({ categoriaServicio: 'REFRIGERACION', id: 'b' }),
      ot({ categoriaServicio: 'LAVADORAS', id: 'c' }),
    ]);

    expect(equipos).toHaveLength(2);
    expect(equipos.find((e) => e.categoria === 'REFRIGERACION')?.intervenciones).toBe(2);
    expect(equipos.find((e) => e.categoria === 'LAVADORAS')?.intervenciones).toBe(1);
  });

  it('la tarjeta muestra la OT más reciente, no la última insertada', () => {
    const equipos = agruparEquipos([
      ot({
        categoriaServicio: 'AIRE_ACONDICIONADO',
        id: 'vieja',
        codigo: 'CD-VIEJA',
        fechaCreacion: '2026-01-05T10:00:00Z',
      }),
      ot({
        categoriaServicio: 'AIRE_ACONDICIONADO',
        id: 'nueva',
        codigo: 'CD-NUEVA',
        fechaCreacion: '2026-10-12T10:00:00Z',
      }),
    ]);

    expect(equipos[0].ultimaOtId).toBe('nueva');
    expect(equipos[0].codigoOt).toBe('CD-NUEVA');
  });

  it('ordena los equipos por la intervención más reciente', () => {
    const equipos = agruparEquipos([
      ot({ categoriaServicio: 'LAVADORAS', fechaCreacion: '2026-03-01T10:00:00Z' }),
      ot({ categoriaServicio: 'REFRIGERACION', fechaCreacion: '2026-09-01T10:00:00Z' }),
    ]);

    expect(equipos.map((e) => e.categoria)).toEqual(['REFRIGERACION', 'LAVADORAS']);
  });

  it('no rompe con una fecha inválida ni con una OT sin código', () => {
    const equipos = agruparEquipos([
      ot({ categoriaServicio: 'REFRIGERACION', codigo: undefined, fechaCreacion: 'no-es-fecha' }),
    ]);

    expect(equipos[0].codigoOt).toBe('Sin código');
    expect(equipos[0].fecha).toBe('Sin fecha');
  });

  it('una categoría nueva no rompe la etiqueta', () => {
    expect(etiquetaCategoria('ENERGIA_SOLAR' as CategoriaServicio)).toBe('energia solar');
  });

  it('usa el nombre de la categoría cuando existe la etiqueta', () => {
    expect(etiquetaCategoria('REFRIGERACION')).toBe('Refrigeración');
  });
});
