import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { environment } from '../environment/environment';

/**
 * Origen del backend: SOLO host, sin path.
 * Es lo unico que varia por entorno, por eso vive en una variable de entorno.
 * Se expone como token para poder sustituirlo en los tests sin tocar environment.
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN', {
  providedIn: 'root',
  factory: () => environment.apiOrigin,
});

/** El prefijo es parte del contrato de la API, no de la infraestructura. */
const API_PREFIX = '/api';

/**
 * Version por defecto. Hoy el backend NO expone version en la ruta (los
 * controllers son /api/clientes, /api/tecnicos), por eso queda vacia.
 * El dia que exista v2, aca va 'v2' y los services migran con versioned().
 */
const API_DEFAULT_VERSION = '';

@Injectable({
  providedIn: 'root'
})
export class ApiConfig {
  private readonly _useMocks = signal<boolean>(environment.useMocks);
  readonly useMocks = this._useMocks.asReadonly();
  readonly useMock = this._useMocks.asReadonly();

  private readonly _origin = signal(inject(API_ORIGIN));
  readonly origin = this._origin.asReadonly();

  setUseMocks(value: boolean): void {
    this._useMocks.set(value);
  }

  toggleMocks(): boolean {
    const next = !this._useMocks();
    this._useMocks.set(next);
    return next;
  }

  toggleMock(): boolean {
    return this.toggleMocks();
  }

  /** URL con la version por defecto. */
  url(path: string): string {
    return this.versioned(API_DEFAULT_VERSION, path);
  }

  /**
   * URL con version explicita. Permite migrar endpoint por endpoint
   * (este service a v2) sin tocar el resto ni las variables de entorno.
   */
  versioned(version: string, path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const versionSegment = version ? `/${version}` : '';
    return `${this._origin()}${API_PREFIX}${versionSegment}${cleanPath}`;
  }
}
