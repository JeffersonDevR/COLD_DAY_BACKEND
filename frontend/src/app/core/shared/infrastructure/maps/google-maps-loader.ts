import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

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

  private async loadScript(): Promise<boolean> {
    try {
      // Check if google maps is already present on window
      const win = window as unknown as { google?: { maps?: unknown } };
      if (win.google?.maps) {
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
          this.isLoaded.set(true);
          this.isLoading.set(false);
          resolve(true);
          return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;

        const url = key
          ? `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry&v=weekly`
          : 'https://maps.googleapis.com/maps/api/js?libraries=geometry&v=weekly';

        script.src = url;

        script.onload = () => {
          this.isLoaded.set(true);
          this.isLoading.set(false);
          resolve(true);
        };

        script.onerror = () => {
          this.isLoading.set(false);
          this.loadError.set('No fue posible cargar Google Maps JavaScript API.');
          resolve(false);
        };

        document.head.appendChild(script);
      });
    } catch (e) {
      this.isLoading.set(false);
      this.loadError.set((e as Error).message || 'Error al inicializar mapa');
      return false;
    }
  }
}
