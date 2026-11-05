import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { PersistenciaToken } from '@core/service/token-persistencia';
import { TOKEN_KEY } from '@core/service/token-storage.service';

/**
 * Espejo del token en Capacitor Preferences.
 *
 * localStorage dentro del WebView puede perderse (limpieza de almacenamiento,
 * reinstalación). Preferences queda en el almacenamiento nativo de la app, así
 * que la sesión sobrevive. No es cifrado: el token sigue siendo un JWT de corta
 * vida y el cifrado real (Keychain/Keystore) es un paso posterior.
 */
@Injectable()
export class PreferencesTokenPersistence implements PersistenciaToken {
  guardar(token: string | null): void {
    void (token
      ? Preferences.set({ key: TOKEN_KEY, value: token })
      : Preferences.remove({ key: TOKEN_KEY }));
  }
}

/**
 * Copia el token de Preferences a localStorage antes de arrancar Angular.
 *
 * Se hace una sola vez, en `main.ts`, porque `TokenStorageService` es síncrono y
 * toda la app (guards incluidos) lo consulta en el arranque.
 */
export async function hidratarTokenDesdePreferences(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (!value) return;

    if (typeof localStorage !== 'undefined' && localStorage.getItem(TOKEN_KEY) !== value) {
      localStorage.setItem(TOKEN_KEY, value);
    }
  } catch {
    // Sin Preferences (web/SSR): localStorage sigue siendo la única fuente.
  }
}
