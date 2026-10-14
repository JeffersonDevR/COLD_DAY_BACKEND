/**
 * Geografía fija del Área Metropolitana de Cúcuta.
 *
 * Fuente única para los mapas del front: el radar de técnicos y el selector de
 * ubicación restringen navegación/zoom a este perímetro y centran la vista en el
 * mismo punto de referencia. Compartir la constante evita que cada mapa derive
 * su propia caja y terminen desalineados.
 */

/** Centro de referencia de Cúcuta (punto neutro para centrar la vista inicial). */
export const CUCUTA_CENTRO = { latitud: 7.8939, longitud: -72.5078 } as const;

/**
 * Límites geográficos estrictos del Área Metropolitana de Cúcuta.
 * Incluye Cúcuta, Los Patios, Villa del Rosario, San Cayetano y corredores viales.
 */
export const CUCUTA_METRO_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 8.08, // Norte: El Salado / Aeropuerto Camilo Daza / Trigal del Norte
  south: 7.76, // Sur: Los Patios / Villa del Rosario / La Parada
  west: -72.6, // Oeste: San Cayetano / Antonia Santos / Belisario
  east: -72.41, // Este: Boconó / Escobal / Anillo Vial Oriental
};
