/**
 * Platform commission charged on each settled OT.
 *
 * Mirror of `environment.commissionRate` (web) and of the backend
 * `app.liquidacion.comision-porcentaje`. The mobile app imports the rate from
 * here instead of the `environment` object, which would drag the Google Maps
 * browser key into the native bundle. Change one, change all three.
 */
export const COMISION_PLATAFORMA_RATE = 0.15;
