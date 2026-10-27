import { Injectable, signal } from '@angular/core';
import { Rol } from '../models/common.models';

/**
 * Claims presentes en el JWT emitido por el backend (JwtTokenIssuer.java):
 * `sub` = usuarioId, `rol`, `ver` (token version), `iat`, `exp`.
 * `nombre`/`correo`/`id` son claims opcionales que solo añade el token simulado
 * del mock local.
 */
export interface DecodedToken {
  sub?: string;
  id?: string | number;
  nombre?: string;
  correo?: string;
  rol?: Rol;
  /** Conjunto de roles derivado del perfil (claim `roles` del JWT, slice 4). */
  roles?: Rol[];
  ver?: number;
  exp?: number;
  iat?: number;
}

const TOKEN_KEY = 'coldday.token';

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  private readonly _currentToken = signal<string | null>(this.getRawToken());
  readonly currentToken = this._currentToken.asReadonly();

  saveToken(token: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
    this._currentToken.set(token);
  }

  getRawToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }

  clearToken(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
    this._currentToken.set(null);
  }

  getDecodedToken(): DecodedToken | null {
    const token = this.getRawToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        // Formato simulado simple: base64 json
        const decoded = atob(token);
        return JSON.parse(decoded) as DecodedToken;
      }
      // JWT estándar
      const payloadBase64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + (c.codePointAt(0) ?? 0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as DecodedToken;
    } catch {
      return null;
    }
  }

  createMockJwt(user: {
    id: string | number;
    nombre: string;
    correo: string;
    rol: Rol;
    roles?: Rol[];
    /**
     * `tokenVersion` simulado. Solo lo usan los mocks de re-adquisición de
     * perfil, que reproducen el incremento que hace el backend.
     */
    ver?: number;
  }): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = this.toBase64Utf8({
      sub: String(user.id),
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      ...(user.roles ? { roles: user.roles } : {}),
      ...(user.ver != null ? { ver: user.ver } : {}),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 días
    });
    const signature = btoa('mock-sig-coldday-fase1');
    return `${header}.${payload}.${signature}`;
  }

  /**
   * base64 de un JSON en UTF-8, como el JWT real. `btoa` solo acepta Latin-1:
   * los nombres del mock llevan tildes y `getDecodedToken` decodifica UTF-8, así
   * que codificar el JSON con `btoa` directo dejaba el token ilegible.
   */
  private toBase64Utf8(value: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  /**
   * JWT simulado de POST /api/clientes/perfil y POST /api/tecnicos/perfil:
   * suma `rol` al conjunto vigente, incrementa `ver` (el backend sube
   * `tokenVersion`) y conserva los claims de identidad (`id`, `nombre`,
   * `correo`), para que la sesión adoptada no pierda el nombre de la persona.
   * Sin sesión previa arma una mínima con el rol pedido como primario.
   */
  createMockJwtConRolAdicional(rol: Rol): string {
    const decoded = this.getDecodedToken();
    const rolesActuales = decoded?.roles?.length
      ? decoded.roles
      : decoded?.rol
        ? [decoded.rol]
        : [];
    return this.createMockJwt({
      id: decoded?.id ?? decoded?.sub ?? 0,
      nombre: decoded?.nombre ?? '',
      correo: decoded?.correo ?? '',
      rol: decoded?.rol ?? rol,
      roles: rolesActuales.includes(rol) ? rolesActuales : [...rolesActuales, rol],
      ver: (decoded?.ver ?? 0) + 1,
    });
  }
}
