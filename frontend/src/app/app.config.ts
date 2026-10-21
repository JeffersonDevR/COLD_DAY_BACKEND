import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';
import {definePreset} from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import {routes} from './app.routes';
import {authInterceptor} from './core/interceptos/auth.interceptor';
import {errorInterceptor} from './core/interceptos/error.interceptor';
import {initializeAppearance} from './core/service/appearance';
import {MapaConfigService} from './core/service/mapa-config.service';

/**
 * Preset Aura con la paleta corporativa de COLD DAY (royal-blue, sky-600 como
 * primario). Es la ÚNICA apariencia de la app: el configurador de tema
 * (color primario, superficie, preset y modo claro/oscuro) se eliminó.
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
    // Limpieza de una sola vez: descarta la preferencia que dejó el
    // configurador eliminado, para que la apariencia fija no dependa de ella.
    provideAppInitializer(initializeAppearance),
    // Configuracion del mapa (centro, limites, zoom y escala de radios): la
    // publica el backend en GET /api/config/maps y se pide una sola vez al
    // arrancar. NO bloquea el arranque: si el backend no responde, la app sigue
    // con los valores por defecto.
    provideAppInitializer(() => {
      void inject(MapaConfigService).cargar();
    }),
    // authInterceptor adjunta el JWT del backend; errorInterceptor traduce ApiError.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: ColdDayPreset,
        options: {
          // La apariencia es fija. El selector apunta a `.dark`, una clase que
          // nadie aplica, de modo que la preferencia del dispositivo
          // (prefers-color-scheme) nunca altera el look royal-blue.
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
