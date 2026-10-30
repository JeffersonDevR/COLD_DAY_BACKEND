import { LOCALE_ID, Provider } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';

/**
 * Locale used by Angular's built-in pipes (dates, numbers, percent).
 *
 * The CLDR data for es-CO must be registered before any pipe runs. Without it
 * `date` and `number` fail with "Missing locale data", so the registration
 * happens as a side effect of importing this module: both the app config and
 * the specs that opt into the locale get it for free.
 */
export const APP_LOCALE_ID = 'es-CO';

registerLocaleData(localeEsCo);

/** Switches the app's default locale to Colombian Spanish. */
export function provideColombianLocale(): Provider[] {
  return [{ provide: LOCALE_ID, useValue: APP_LOCALE_ID }];
}
