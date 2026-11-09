import {bootstrapApplication} from '@angular/platform-browser';
import {addIcons} from 'ionicons';
import {
  addCircleOutline,
  addOutline,
  alertCircleOutline,
  arrowBackOutline,
  arrowForwardOutline,
  buildOutline,
  calendarOutline,
  callOutline,
  carOutline,
  cardOutline,
  cash,
  cashOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronForwardOutline,
  closeCircleOutline,
  closeOutline,
  compassOutline,
  construct,
  constructOutline,
  createOutline,
  cube,
  cubeOutline,
  documentText,
  documentTextOutline,
  ellipseOutline,
  eyeOffOutline,
  eyeOutline,
  fileTrayOutline,
  flashOutline,
  hammerOutline,
  home,
  homeOutline,
  idCardOutline,
  informationCircleOutline,
  locationOutline,
  lockClosedOutline,
  logOutOutline,
  mailOutline,
  mapOutline,
  navigateOutline,
  notificationsOutline,
  person,
  personOutline,
  radio,
  radioOutline,
  refreshOutline,
  reloadOutline,
  searchOutline,
  shieldCheckmarkOutline,
  snowOutline,
  star,
  starOutline,
  swapHorizontalOutline,
  thermometerOutline,
  thumbsDownOutline,
  thumbsUpOutline,
  timeOutline,
  trashOutline,
  walletOutline,
  waterOutline,
  videocamOutline,
} from 'ionicons/icons';
import {MobileApp} from './app/app';
import {appConfig} from './app/app.config';
import {MOBILE_API_ORIGIN} from './app/core/environment/mobile-origin';

// Icons are tree-shaken: every icon referenced by a screen must be registered.
// `-outline` for inactive/default, plain (filled) for active tabs/selected states.
// NOTE: `badge-outline` does not exist in ionicons; `id-card-outline` is the
// equivalent glyph for document/ID affordances.
addIcons({
  addCircleOutline,
  addOutline,
  alertCircleOutline,
  arrowBackOutline,
  arrowForwardOutline,
  buildOutline,
  calendarOutline,
  callOutline,
  carOutline,
  cardOutline,
  cash,
  cashOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronForwardOutline,
  closeCircleOutline,
  closeOutline,
  compassOutline,
  construct,
  constructOutline,
  createOutline,
  cube,
  cubeOutline,
  documentText,
  documentTextOutline,
  ellipseOutline,
  eyeOffOutline,
  eyeOutline,
  fileTrayOutline,
  flashOutline,
  hammerOutline,
  home,
  homeOutline,
  idCardOutline,
  informationCircleOutline,
  locationOutline,
  lockClosedOutline,
  logOutOutline,
  mailOutline,
  mapOutline,
  navigateOutline,
  notificationsOutline,
  person,
  personOutline,
  radio,
  radioOutline,
  refreshOutline,
  reloadOutline,
  searchOutline,
  shieldCheckmarkOutline,
  snowOutline,
  star,
  starOutline,
  swapHorizontalOutline,
  thermometerOutline,
  thumbsDownOutline,
  thumbsUpOutline,
  timeOutline,
  trashOutline,
  walletOutline,
  waterOutline,
  videocamOutline,
});

/**
 * La app móvil NO tiene proxy: si el build se hizo sin `MOBILE_API_ORIGIN`, cada
 * llamada queda relativa contra el propio WebView (`capacitor://localhost/api/…`)
 * y la app no puede hablar con el backend. Antes eso solo dejaba un warning en
 * la consola del build y el APK salía roto. Ahora el arranque lo dice en pantalla.
 */
function faltaElOrigenDelBackend(): boolean {
  if (MOBILE_API_ORIGIN) return false;
  document.body.innerHTML =
    '<main style="font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;'
    + 'min-height:100vh;display:grid;place-items:center;padding:2rem;text-align:center">'
    + '<div><h1 style="font-size:1.25rem;margin:0 0 .5rem">Configuración incompleta</h1>'
    + '<p style="margin:0;color:#94a3b8;max-width:32rem;line-height:1.5">'
    + 'Esta compilación no tiene <code>API_ORIGIN</code>, así que no puede conectarse al '
    + 'backend. Recompilá con <code>API_ORIGIN=https://…</code> definido en <code>.env</code>.'
    + '</p></div></main>';
  return true;
}

if (!faltaElOrigenDelBackend()) {
  bootstrapApplication(MobileApp, appConfig).catch((err) => console.error(err));
}
