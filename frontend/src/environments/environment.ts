import { GOOGLE_MAPS_API_KEY } from './maps-key';

export const environment = {
  production: false,
  /**
   * Ruta base de la API. En desarrollo '/api' se resuelve contra proxy.conf.json
   * (que reenvía al backendUrl). En producción debe enrutarse al backend desde la
   * infraestructura (mismo origen) o reemplazarse por la URL absoluta del backend.
   */
  apiBaseUrl: '/api',
  /**
   * URL del backend Spring Boot. La usa únicamente proxy.conf.json durante `ng serve`.
   * PLACEHOLDER: ajustar si el backend corre en otro host/puerto.
   */
  backendUrl: 'http://localhost:8080',
  /**
   * Browser key de Google Maps Platform (flujo build-time).
   * NO se versiona: se inyecta en build desde GOOGLE_MAPS_API_KEY
   * (frontend/.env o variable de entorno) vía scripts/generate-maps-key.mjs,
   * que genera src/environments/maps-key.ts (gitignored).
   * Si queda vacía, el loader intenta /api/config/maps (solo con SSR).
   */
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  useMocks: false, // Producción: siempre API REST del backend
  appName: 'COLD DAY S.A.S.',
  city: 'Cúcuta, Colombia',
  defaultSearchRadiusKm: 10,
  maxSearchRadiusKm: 25,
  radiusIncrementStepKm: 5,
  broadcastTimeoutSec: 60,
  commissionRate: 0.15, // 15% de comisión plataforma (app.liquidacion.comision-porcentaje=0.15)
  cancellationGraceMinutes: 10,
};
