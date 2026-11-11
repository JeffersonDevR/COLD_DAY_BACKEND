import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  Router,
  provideRouter,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { authInterceptor } from '@core/interceptos/auth.interceptor';
import { API_ORIGIN } from '@core/service/api.config';
import { MOBILE_API_ORIGIN } from './core/environment/mobile-origin';
import { registrarDeepLinks } from './core/deep-links';
import { VISIBILITY_SOURCE } from '@core/service/visible-tab-polling';
import { provideColombianLocale } from '@core/i18n/locale';
import { routes } from './app.routes';
import { mobileErrorInterceptor } from './core/mobile-error.interceptor';
import { provideAvisoSesion } from './core/toast.service';
import { visibilidadMovil } from './core/app-visibility';
import { TOKEN_PERSISTENCIA } from '@core/service/token-persistencia';
import { PreferencesTokenPersistence } from './core/token-preferences';

/**
 * Providers de la app móvil.
 *
 * - El core compartido solo depende de puertos: `AVISO_SESION` se cubre con un
 *   toast de Ionic, así que PrimeNG nunca entra al bundle móvil.
 * - `API_ORIGIN` sale del mismo módulo generado que usa la web (build-time),
 *   para no hardcodear el host del backend.
 * - `es-CO` es el locale de las fechas y números: sin él, `DatePipe` cae a
 *   en-US y las fechas del panel se leen con el formato equivocado.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, mobileErrorInterceptor])),
    { provide: API_ORIGIN, useValue: MOBILE_API_ORIGIN },
    // En nativo la visibilidad sale del ciclo de vida del sistema, no del WebView.
    { provide: VISIBILITY_SOURCE, useFactory: visibilidadMovil },
    // Espejo del token en Preferences: la sesión sobrevive a la limpieza del WebView.
    { provide: TOKEN_PERSISTENCIA, useClass: PreferencesTokenPersistence },
    provideColombianLocale(),
    provideAvisoSesion(),
    // Enlaces profundos: no-op mientras DEEP_LINKS.habilitado sea false (la app
    // todavía no está publicada). Ver core/deep-links.ts para el manifiesto.
    provideAppInitializer(() => registrarDeepLinks(inject(Router))),
  ],
};
