import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environment/environment';

/**
 * Intervalo entre sondeos de readiness de la API de Google Maps.
 */
const READINESS_POLL_INTERVAL_MS = 25;

/**
 * Tiempo máximo por defecto que se espera a que la API quede lista.
 * Es el valor de `readinessTimeoutMs`; las pruebas pueden reducirlo.
 */
const DEFAULT_READINESS_TIMEOUT_MS = 10_000;

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly apiKey = signal<string>('');

  private loadPromise: Promise<boolean> | null = null;

  /**
   * Espera de readiness compartida: si `onload`, el callback global y el arranque
   * de la carga piden readiness a la vez, reutilizan la misma espera (un solo
   * sondeo y un solo timeout).
   */
  private readinessPromise: Promise<boolean> | null = null;

  /**
   * Se activa cuando el script falla al cargar: detiene el sondeo de readiness
   * para no pisar el error ni dejar timers colgados.
   */
  private readinessCancelled = false;

  /**
   * Tiempo máximo (ms) que `waitForReady` espera a que la API quede utilizable.
   * Campo privado y sobreescribible: las pruebas lo bajan para no esperar 10s.
   */
  private readinessTimeoutMs = DEFAULT_READINESS_TIMEOUT_MS;

  init(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(false);
    }

    if (this.isLoaded()) {
      return Promise.resolve(true);
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading.set(true);
    this.loadPromise = this.loadScript();
    return this.loadPromise;
  }

  /**
   * Predicado de readiness real de la API.
   *
   * La sola presencia de `google.maps` NO alcanza: el bootstrap asíncrono de
   * Google crea `google.maps` como un objeto casi vacío en su primera sentencia
   * (`window.google = window.google || {}; google.maps = google.maps || {};`),
   * así que puede existir mientras la API todavía no está operativa. El contrato
   * que consume `@angular/google-maps` (GoogleMap/GoogleMarker en su ngOnInit)
   * es `google.maps.importLibrary`, por lo que exigimos que sea una función.
   */
  private isMapsReady(): boolean {
    const win = window as unknown as {
      google?: { maps?: { importLibrary?: unknown } };
    };
    return typeof win.google?.maps?.importLibrary === 'function';
  }

  /**
   * Espera hasta que la API quede realmente lista, sondeando cada
   * `READINESS_POLL_INTERVAL_MS`. Nunca resuelve `true` por sí sola: si vence el
   * timeout, marca `loadError` con un mensaje en español y resuelve `false`.
   *
   * Es single-flight: las sucesivas invocaciones (arranque de la carga, `onload`,
   * callback global) reutilizan la misma espera.
   */
  private waitForReady(): Promise<boolean> {
    if (!this.readinessPromise) {
      this.readinessPromise = new Promise<boolean>((resolve) => {
        const startedAt = Date.now();
        const check = () => {
          if (this.readinessCancelled) {
            return;
          }
          if (this.isMapsReady()) {
            this.isLoaded.set(true);
            this.isLoading.set(false);
            resolve(true);
            return;
          }
          if (Date.now() - startedAt >= this.readinessTimeoutMs) {
            this.isLoading.set(false);
            this.loadError.set(
              'Tiempo de espera agotado: Google Maps JavaScript API no quedó disponible.'
            );
            resolve(false);
            return;
          }
          setTimeout(check, READINESS_POLL_INTERVAL_MS);
        };
        check();
      });
    }
    return this.readinessPromise;
  }

  private async loadScript(): Promise<boolean> {
    try {
      // Si la API ya está operativa, no hay nada que cargar.
      if (this.isMapsReady()) {
        this.isLoaded.set(true);
        this.isLoading.set(false);
        return true;
      }

      // 1) Clave inyectada en build (environment.googleMapsApiKey).
      // 2) Endpoint /api/config/maps, solo disponible si SSR está habilitado.
      let key = environment.googleMapsApiKey?.trim() ?? '';
      if (!key) {
        try {
          const config = await firstValueFrom(this.http.get<{ apiKey?: string }>('/api/config/maps'));
          if (config?.apiKey) {
            key = config.apiKey.trim();
          }
        } catch {
          // Sin SSR ni clave en environment: se intenta cargar el script sin clave.
        }
      }
      if (key) {
        this.apiKey.set(key);
      }

      // If no key is set yet, we still check or attempt with standard endpoint
      return new Promise<boolean>((resolve) => {
        const scriptId = 'google-maps-platform-script';
        if (document.getElementById(scriptId)) {
          // El tag ya está en el DOM, pero eso no prueba que la API esté lista:
          // esperamos la readiness real en vez de resolver de inmediato.
          this.waitForReady().then(resolve);
          return;
        }

        const callbackName = '__coldDayMapsInit';
        const winWithCb = window as unknown as Record<string, unknown>;
        winWithCb[callbackName] = () => {
          // El callback global solo indica que el bootstrap terminó; verificamos
          // la readiness real antes de resolver.
          this.waitForReady().then(resolve);
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;

        // `loading=async` + callback: patrón recomendado por Google (evita el
        // warning de performance de la carga directa).
        const base = 'https://maps.googleapis.com/maps/api/js?libraries=geometry&v=weekly&loading=async';
        const url = key
          ? `${base}&key=${encodeURIComponent(key)}&callback=${callbackName}`
          : `${base}&callback=${callbackName}`;

        script.src = url;

        script.onload = () => {
          // Con `loading=async`, `onload` se dispara ANTES de que la API esté
          // lista, así que NO basta para resolver: esperamos la readiness real.
          this.waitForReady().then(resolve);
        };

        script.onerror = () => {
          this.readinessCancelled = true;
          this.isLoading.set(false);
          this.loadError.set('No fue posible cargar Google Maps JavaScript API.');
          resolve(false);
        };

        document.head.appendChild(script);

        // Armamos la espera apenas comienza la carga: aunque `onload` ni el
        // callback llegaran a dispararse, el timeout de readiness sigue vigente
        // y la promesa siempre resuelve.
        this.waitForReady().then(resolve);
      });
    } catch (e) {
      this.isLoading.set(false);
      this.loadError.set((e as Error).message || 'Error al inicializar mapa');
      return false;
    }
  }
}
