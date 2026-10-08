import { GOOGLE_MAPS_API_KEY } from './maps-key';
import { API_ORIGIN } from './api-origin';

export const environment = {
  production: false,
  /**
   * Origen del backend (SOLO host, sin path).
   *
   * NO se versiona: la inyecta en build scripts/generate-api-origin.mjs a partir
   * de API_ORIGIN (frontend/.env o variable de entorno), que genera
   * src/app/core/environment/api-origin.ts (gitignored).
   *
   * El prefijo '/api' y la version de la API NO viven aca: viven en el codigo
   * (api.config.ts). Por eso aca nunca va '/api'.
   *
   * - Sin API_ORIGIN queda vacío (default de desarrollo): url('/x') devuelve la
   *   ruta relativa '/api/x', que en `ng serve` resuelve proxy.conf.json contra
   *   backendUrl (dev local, mismo origen).
   * - En producción (Vercel) no hay proxy: se define
   *   API_ORIGIN=https://<backend> (sin path) para que el código le agregue '/api'.
   */
  apiOrigin: API_ORIGIN,
  /**
   * URL del backend Spring Boot. La usa únicamente proxy.conf.json durante `ng serve`.
   * PLACEHOLDER: ajustar si el backend corre en otro host/puerto.
   */
  backendUrl: 'http://localhost:8090',
  /**
   * Browser key de Google Maps Platform (flujo build-time).
   * NO se versiona: se inyecta en build desde GOOGLE_MAPS_API_KEY
   * (frontend/.env o variable de entorno) vía scripts/generate-maps-key.mjs,
   * que genera src/app/core/environment/maps-key.ts (gitignored).
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
  /**
   * Máximo de auxiliares declarables al aceptar una oferta. Debe espejar
   * `app.auxiliares.max` del backend (default 10); el backend es la autoridad y
   * responde 400 si el conteo lo excede.
   */
  auxiliaresMax: 10,
};
