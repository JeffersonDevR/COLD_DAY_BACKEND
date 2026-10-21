import { distanciaHaversineKm, rutaLocal, VELOCIDAD_MEDIA_KMH } from './distancia-local';

describe('distancia local (haversine)', () => {
  const destino = { latitud: 7.88, longitud: -72.49 };

  it('mide la distancia en línea recta entre dos puntos', () => {
    const km = distanciaHaversineKm({ latitud: 7.9, longitud: -72.5 }, destino);
    expect(km).toBeCloseTo(2.4817, 4);
  });

  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaHaversineKm(destino, destino)).toBe(0);
  });

  it('estima la ETA con la velocidad media de referencia', () => {
    const ruta = rutaLocal({ latitud: 7.9, longitud: -72.5 }, destino);
    expect(ruta.distanciaKm).toBe(2.48);
    expect(ruta.duracionMin).toBe(6);
    // La ETA sale de la distancia con la velocidad media (25 km/h).
    expect(ruta.duracionMin).toBe(Math.round((ruta.distanciaKm / VELOCIDAD_MEDIA_KMH) * 60));
  });

  it('la ETA crece con la distancia', () => {
    const lejos = rutaLocal({ latitud: 7.95, longitud: -72.55 }, destino);
    const cerca = rutaLocal({ latitud: 7.881, longitud: -72.491 }, destino);
    expect(lejos.distanciaKm).toBeGreaterThan(cerca.distanciaKm);
    expect(lejos.duracionMin).toBeGreaterThan(cerca.duracionMin);
  });
});
