/**
 * Apariencia fija de la app (M11): se eliminó el configurador de tema
 * (selector de color, modo claro/oscuro y presets). El aspecto royal-blue
 * queda definido estáticamente en `app.config.ts` (preset de PrimeNG) y en
 * `styles.css` (tokens Tailwind `sky-*`/`slate-*`).
 *
 * Este módulo solo se encarga de la limpieza de una sola vez: descartar la
 * preferencia que dejó el configurador eliminado para que las elecciones
 * antiguas de los usuarios no se honren nunca.
 */

/** Clave que usaba el configurador de tema eliminado. */
export const LEGACY_THEME_STORAGE_KEY = 'coldday.theme';

/**
 * Recorte mínimo de `Storage` necesario para la limpieza: aceptar una interfaz
 * pequeña mantiene la función pura y fácil de probar.
 */
export interface RemovableStorage {
  removeItem(key: string): void;
}

/**
 * Elimina la preferencia de tema heredada. Es idempotente y no falla cuando no
 * hay almacenamiento (SSR, navegadores con localStorage bloqueado).
 */
export function clearLegacyThemePreference(storage: RemovableStorage | null | undefined): void {
  storage?.removeItem(LEGACY_THEME_STORAGE_KEY);
}

/** Inicializador de arranque: ejecuta la limpieza una vez en el navegador. */
export function initializeAppearance(): void {
  clearLegacyThemePreference(typeof window === 'undefined' ? null : window.localStorage);
}
