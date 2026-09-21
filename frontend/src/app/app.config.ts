import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';

import {routes} from './app.routes';
import {authInterceptor} from './core/shared/infrastructure/auth/auth.interceptor';
import {errorInterceptor} from './core/shared/infrastructure/api/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // authInterceptor adjunta el JWT del backend; errorInterceptor traduce ApiError.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
