import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {IonicRouteStrategy, provideIonicAngular} from '@ionic/angular';
import {routes} from './app.routes';

/**
 * Mobile app providers.
 *
 * No HTTP interceptors yet: `errorInterceptor` lives in `@core` but depends on
 * `ToastService`, which is a PrimeNG facade (web-only UI). Wiring core auth and
 * error handling is P1 work, once the mobile toast/alert adapter exists.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({mode: 'md'}),
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
  ],
};
