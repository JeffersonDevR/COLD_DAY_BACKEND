import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';
import { ToastService } from '../../presentation/toast.service';
import { Rol, TokenResponse, UsuarioResponse } from '../../domain/models/common.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Temporizador que cierra la sesión justo cuando expira el JWT. */
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _currentUser = signal<UsuarioResponse | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  readonly isAuthenticated = computed(() => !!this._currentUser() || !!this.tokenStorage.currentToken());
  readonly userRole = computed<Rol | null>(() => this._currentUser()?.rol ?? this.tokenStorage.getDecodedToken()?.rol ?? null);

  constructor() {
    this.restoreSession();
    this.programarExpiracionSesion();
  }

  /**
   * Reconstruye la sesión a partir del JWT persistido. El backend no expone un
   * endpoint de perfil, así que los datos disponibles son los claims del token
   * (`sub` = usuarioId, `rol`). Se descarta si el token ya expiró.
   */
  private restoreSession(): void {
    const decoded = this.tokenStorage.getDecodedToken();
    if (!decoded?.rol || this.tokenExpirado(decoded.exp)) {
      this.tokenStorage.clearToken();
      return;
    }
    this._currentUser.set({
      id: Number(decoded.id ?? decoded.sub ?? 0),
      nombre: decoded.nombre ?? decoded.correo ?? 'Usuario',
      correo: decoded.correo ?? '',
      rol: decoded.rol,
      habeasDataAceptado: true,
      activo: true,
    });
  }

  /** true si el `exp` (epoch segundos) ya pasó. */
  private tokenExpirado(exp?: number): boolean {
    return exp != null && exp * 1000 <= Date.now();
  }

  /**
   * Programa el cierre de sesión exactamente al expirar el JWT para evitar la
   * ráfaga de 401 que dejaría el usuario sin aviso. No renueva la sesión
   * (no hay refresh token; el usuario debe volver a iniciar sesión).
   */
  private programarExpiracionSesion(): void {
    if (!this.isBrowser) return;
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    const exp = this.tokenStorage.getDecodedToken()?.exp;
    if (!exp) return;

    const ms = exp * 1000 - Date.now();
    if (ms <= 0) {
      this.expirarSesion();
      return;
    }
    this.expiryTimer = setTimeout(() => this.expirarSesion(), ms);
  }

  private expirarSesion(): void {
    if (!this.isAuthenticated()) return;
    this.toast.warning('Sesión expirada', 'Tu sesión caducó. Inicia sesión de nuevo para continuar.');
    this.logout();
  }

  setCurrentUser(user: UsuarioResponse, token?: string): void {
    const jwt = token ?? this.tokenStorage.createMockJwt({
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
    });
    this.tokenStorage.saveToken(jwt);
    this._currentUser.set(user);
    this.programarExpiracionSesion();
  }

  /**
   * Establece la sesión a partir de la respuesta REAL del backend
   * (POST /api/usuarios/login → {token, expiracion, rol}).
   *
   * El perfil se reconstruye desde los claims del JWT. Si el mock ya entrega el
   * usuario completo, se usa ese valor.
   *
   * Pendiente(backend): no existe `GET /api/usuarios/me`, por lo que `nombre` se
   * aproxima con el correo ingresado hasta que el backend exponga el perfil.
   */
  establecerSesionDesdeToken(
    res: TokenResponse,
    correoIngresado: string,
    usuarioCompleto?: UsuarioResponse,
  ): UsuarioResponse {
    this.tokenStorage.saveToken(res.token);
    const decoded = this.tokenStorage.getDecodedToken();
    const usuario: UsuarioResponse = usuarioCompleto ?? {
      id: Number(decoded?.id ?? decoded?.sub ?? 0),
      nombre: decoded?.nombre ?? correoIngresado,
      correo: decoded?.correo ?? correoIngresado,
      rol: decoded?.rol ?? res.rol,
      habeasDataAceptado: true,
      activo: true,
    };
    this._currentUser.set(usuario);
    this.programarExpiracionSesion();
    return usuario;
  }

  logout(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.tokenStorage.clearToken();
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  switchDemoRole(rol: Rol): void {
    const demoProfiles: Record<string, UsuarioResponse> = {
      ADMINISTRADOR: {
        id: 1,
        nombre: 'Carlos Méndez',
        correo: 'carlos.admin@coldday.com.co',
        telefono: '3104567890',
        rol: 'ADMINISTRADOR',
        habeasDataAceptado: true,
        activo: true,
      },
      CONTABLE: {
        id: 2,
        nombre: 'Ana Martínez',
        correo: 'ana.contable@coldday.com.co',
        telefono: '3156789012',
        rol: 'CONTABLE',
        habeasDataAceptado: true,
        activo: true,
      },
      CLIENTE: {
        id: 3,
        nombre: 'María Gómez',
        correo: 'maria.gomez@gmail.com',
        telefono: '3187654321',
        rol: 'CLIENTE',
        habeasDataAceptado: true,
        activo: true,
      },
      TECNICO: {
        id: 6,
        nombre: 'Juan Pérez',
        correo: 'juan.tecnico@coldday.com.co',
        telefono: '3001234567',
        rol: 'TECNICO',
        habeasDataAceptado: true,
        activo: true,
      },
    };
    const target = demoProfiles[rol] || demoProfiles['CLIENTE'];
    this.setCurrentUser(target);
  }

  getDashboardRouteForRole(rol: Rol): string {
    switch (rol) {
      case 'CLIENTE':
        return '/panel';
      case 'TECNICO':
        return '/tecnico/ofertas';
      case 'ADMINISTRADOR':
      case 'CONTABLE':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  }
}
