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
   * PLACEHOLDER: clave de Google Maps Platform.
   * Con SSR desactivado el endpoint /api/config/maps deja de existir, así que la
   * clave se inyecta en build desde acá (o vía variable de entorno del bundler).
   * Si queda vacía, los mapas intentan cargarse sin clave y fallarán.
   */
  googleMapsApiKey: '',
  useMocks: true, // Conmutable por UI o variable
  appName: 'COLD DAY S.A.S.',
  city: 'Cúcuta, Colombia',
  defaultSearchRadiusKm: 10,
  maxSearchRadiusKm: 25,
  radiusIncrementStepKm: 5,
  broadcastTimeoutSec: 60,
  commissionRate: 0.15, // 15% de comisión plataforma (app.liquidacion.comision-porcentaje=0.15)
  cancellationGraceMinutes: 10,
};
