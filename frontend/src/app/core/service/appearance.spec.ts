import {
  LEGACY_THEME_STORAGE_KEY,
  clearLegacyThemePreference,
  initializeAppearance,
} from './appearance';

describe('initializeAppearance', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('elimina la preferencia de tema heredada y respeta las demás claves', () => {
    window.localStorage.setItem(
      LEGACY_THEME_STORAGE_KEY,
      JSON.stringify({ dark: true, preset: 'Lara', primary: 'violet', surface: 'zinc' }),
    );
    window.localStorage.setItem('coldday.layout', JSON.stringify({ menuMode: 'overlay' }));

    initializeAppearance();

    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('coldday.layout')).toBe(
      JSON.stringify({ menuMode: 'overlay' }),
    );
  });

  it('elimina exactamente la clave del configurador eliminado', () => {
    const removed: string[] = [];
    const storage = { removeItem: (key: string) => removed.push(key) };
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'dark');

    clearLegacyThemePreference(storage);

    expect(removed).toEqual([LEGACY_THEME_STORAGE_KEY]);
    // El almacenamiento real no se toca: la función solo opera sobre el recorte recibido.
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBe('dark');
  });

  it('no falla cuando no hay almacenamiento disponible', () => {
    expect(() => clearLegacyThemePreference(null)).not.toThrow();
    expect(() => clearLegacyThemePreference(undefined)).not.toThrow();
  });
});
