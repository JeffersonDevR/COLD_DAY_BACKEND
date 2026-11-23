import { CategoriaServicio } from '@core/models/common.models';

/**
 * Icono Ionicons por categoría de servicio, para las pantallas del móvil que
 * muestran tarjetas por categoría (B1 radar de ofertas, A10 mis equipos).
 *
 * El mapa vive en el proyecto móvil a propósito: la web usa PrimeIcons, ver el
 * docblock de `@core/service/equipos-cliente` ("el icono no está acá: cada
 * plataforma usa el suyo"). Los glifos ya están registrados en `main.ts`
 * (addIcons); ionicons no tiene `water-drop`, así que lavadoras usa
 * `water-outline`.
 */
export const ICONOS_CATEGORIA: Record<CategoriaServicio, string> = {
  CAMARAS_VIGILANCIA: 'videocam-outline',
  REFRIGERACION: 'snow-outline',
  AIRE_ACONDICIONADO: 'thermometer-outline',
  LAVADORAS: 'water-outline',
  ELECTRICIDAD: 'flash-outline',
};

/** Icono decorativo de la categoría; con dato desconocido cae a herramientas. */
export function iconoCategoria(categoria: CategoriaServicio): string {
  return ICONOS_CATEGORIA[categoria] || 'construct-outline';
}
