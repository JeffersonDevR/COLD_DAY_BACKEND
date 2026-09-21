import { Injectable, signal } from '@angular/core';
import { Rol } from '../../domain/models/common.models';

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
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as DecodedToken;
    } catch {
      return null;
    }
  }

  createMockJwt(user: { id: string | number; nombre: string; correo: string; rol: Rol }): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: String(user.id),
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 días
      })
    );
    const signature = btoa('mock-sig-coldday-fase1');
    return `${header}.${payload}.${signature}`;
  }
}
