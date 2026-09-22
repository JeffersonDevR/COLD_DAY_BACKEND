import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';
import {definePreset} from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import {routes} from './app.routes';
import {authInterceptor} from './core/shared/infrastructure/auth/auth.interceptor';
import {errorInterceptor} from './core/shared/infrastructure/api/error.interceptor';

/**
 * Preset Aura con la paleta corporativa de COLD DAY (sky-600 como primario),
 * alineada con los colores que ya usaba la app y la landing estática.
 */
const ColdDayPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // authInterceptor adjunta el JWT del backend; errorInterceptor traduce ApiError.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: ColdDayPreset,
        options: {
          // El ThemeService de la app alterna la clase `.dark` en <html>.
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
