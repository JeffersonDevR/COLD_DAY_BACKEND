import { describe, expect, it } from 'vitest';
import { decodificarPolyline } from './polyline';

describe('decodificarPolyline', () => {
  it('decodifica el ejemplo de la documentación de Google', () => {
    const puntos = decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');

    expect(puntos).toHaveLength(3);
    expect(puntos![0].lat).toBeCloseTo(38.5, 5);
    expect(puntos![0].lng).toBeCloseTo(-120.2, 5);
    expect(puntos![1].lat).toBeCloseTo(40.7, 5);
    expect(puntos![1].lng).toBeCloseTo(-120.95, 5);
    expect(puntos![2].lat).toBeCloseTo(43.252, 5);
    expect(puntos![2].lng).toBeCloseTo(-126.453, 5);
  });

  it('devuelve null para null, undefined y cadena vacía', () => {
    expect(decodificarPolyline(null)).toBeNull();
    expect(decodificarPolyline(undefined)).toBeNull();
    expect(decodificarPolyline('')).toBeNull();
  });

  it('devuelve null si la cadena está truncada', () => {
    expect(decodificarPolyline('_p~iF~ps|U_ulLnnq')).toBeNull();
  });

  it('devuelve null si solo hay un punto', () => {
    expect(decodificarPolyline('_p~iF~ps|U')).toBeNull();
  });
});
