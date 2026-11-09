import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DecodedToken, TokenStorageService } from './token-storage.service';
import { CLAVE_COMPARTIR_UBICACION } from './tecnico-presencia.service';
import { AVISO_SESION } from '../alertas/aviso-sesion';
import { Rol, TokenResponse, UsuarioResponse } from '../models/common.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly avisoSesion = inject(AVISO_SESION);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Temporizador que cierra la sesión justo cuando expira el JWT. */
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _currentUser = signal<UsuarioResponse | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  readonly isAuthenticated = computed(() => !!this._currentUser() || !!this.tokenStorage.currentToken());
  readonly userRole = computed<Rol | null>(() => this._currentUser()?.rol ?? this.tokenStorage.getDecodedToken()?.rol ?? null);

  /**
   * Conjunto de roles del usuario (claim `roles` del JWT). Un usuario dual
   * (Cliente + Técnico) lo trae con ambos; `userRole` sigue siendo el primario.
   * Cae a `[rol]` cuando el token es legado o el mock no declara el conjunto.
   */
  readonly userRoles = computed<Set<Rol>>(() => {
    const fromUser = this._currentUser()?.roles;
    const fromToken = this.tokenStorage.getDecodedToken()?.roles;
    const roles = fromUser?.length ? fromUser : fromToken?.length ? fromToken : null;
    if (roles) return new Set(roles);
    const primary = this.userRole();
    return primary ? new Set<Rol>([primary]) : new Set<Rol>();
  });

  constructor() {
    this.restoreSession();
    this.programarExpiracionSesion();
  }

  /**
   * Reconstruye la sesión a partir del JWT persistido. El backend no expone un
   * endpoint de perfil, así que los datos disponibles son los claims del token
   * (`sub` = usuarioId, `rol`). Se descarta si el token ya expiró.
   *
   * `nombre` queda vacío cuando el token no lo trae (el JWT real no emite
   * `nombre` ni `correo`; solo lo hace el token simulado). No se rellena con un
   * literal: quien lo muestre decide cómo nombrar a una sesión sin nombre.
   */
  private restoreSession(): void {
    const decoded = this.tokenStorage.getDecodedToken();
    if (!decoded?.rol || this.tokenExpirado(decoded.exp)) {
      this.tokenStorage.clearToken();
      return;
    }
    this._currentUser.set({
      id: Number(decoded.id ?? decoded.sub ?? 0),
      nombre: this.nombreDeSesion(decoded),
      correo: decoded.correo ?? '',
      rol: decoded.rol,
      roles: decoded.roles,
      habeasDataAceptado: true,
      activo: true,
    });
  }

  /**
   * Regla única del nombre de sesión: SOLO el claim `nombre`, y cadena vacía
   * cuando el token no lo trae (el JWT real no lo emite; solo el token simulado).
   * La usan el login y la restauración del token persistido para que ambos
   * caminos devuelvan el mismo valor y ninguna persona quede renombrada con su
   * correo. Quien lo muestre decide el rótulo cuando llega vacío.
   */
  private nombreDeSesion(decoded: DecodedToken | null): string {
    return decoded?.nombre ?? '';
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
    this.avisoSesion.advertir(
      'Sesión expirada',
      'Tu sesión caducó. Inicia sesión de nuevo para continuar.',
    );
    this.logout();
  }

  setCurrentUser(user: UsuarioResponse, token?: string): void {
    const jwt = token ?? this.tokenStorage.createMockJwt({
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      roles: user.roles,
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
   * Pendiente(backend): no existe `GET /api/usuarios/me`, así que `nombre` solo
   * puede salir del claim homónimo (vacío en el JWT real) y el correo ingresado
   * se usa únicamente como `correo`; ambos caminos comparten `nombreDeSesion`.
   */
  establecerSesionDesdeToken(
    res: TokenResponse,
    correoIngresado: string,
    usuarioCompleto?: UsuarioResponse,
  ): UsuarioResponse {
    this.tokenStorage.saveToken(res.token);
    const decoded = this.tokenStorage.getDecodedToken();
    const roles = decoded?.roles ?? res.roles;
    let usuario: UsuarioResponse;
    if (usuarioCompleto) {
      usuario = !usuarioCompleto.roles?.length && roles?.length
        ? { ...usuarioCompleto, roles }
        : usuarioCompleto;
    } else {
      usuario = {
        id: Number(decoded?.id ?? decoded?.sub ?? 0),
        nombre: this.nombreDeSesion(decoded),
        correo: decoded?.correo ?? correoIngresado,
        rol: decoded?.rol ?? res.rol,
        roles,
        habeasDataAceptado: true,
        activo: true,
      };
    }
    this._currentUser.set(usuario);
    this.programarExpiracionSesion();
    return usuario;
  }

  /**
   * Adopta el JWT que devuelve la adquisición de un segundo perfil.
   *
   * El backend sube `tokenVersion` al crear el perfil y entrega el reemplazo en
   * la misma respuesta. Delegar en `establecerSesionDesdeToken` mantiene una
   * sola ruta de construcción de sesión: se refrescan `currentUser`,
   * `userRoles` y el temporizador de expiración como en el login. No hay
   * logout: la sesión sigue viva con el conjunto de roles nuevo.
   */
  adoptarToken(token: string): UsuarioResponse {
    this.tokenStorage.saveToken(token);
    const decoded = this.tokenStorage.getDecodedToken();
    return this.establecerSesionDesdeToken(
      {
        token,
        expiracion: '',
        rol: decoded?.rol ?? this._currentUser()?.rol ?? 'CLIENTE',
        roles: decoded?.roles,
      },
      this._currentUser()?.correo ?? '',
    );
  }

  logout(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.tokenStorage.clearToken();
    this.olvidarCompartirUbicacion();
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Location sharing is a device preference, but it belongs to the technician
   * who turned it on: on a shared browser the next login must not inherit
   * "compartiendo". Theme, layout and panel preference are not session state
   * and stay untouched.
   */
  private olvidarCompartirUbicacion(): void {
    if (!this.isBrowser) return;
    try {
      window.localStorage.removeItem(CLAVE_COMPARTIR_UBICACION);
    } catch {
      // Storage blocked: there was nothing persisted to remove.
    }
  }

  /**
   * Landing tras el login, por rol. NO es el resolutor de paneles: `/panel`,
   * "Mi Panel" y la preferencia del último panel visitado viven en
   * `core/navihationError/panel-resolver` (un solo mapa de rutas de panel). No
   * agregar aquí un cuarto mapa: si cambia una ruta de panel, cambia allá.
   */
  getDashboardRouteForRole(rol: Rol): string {
    switch (rol) {
      case 'CLIENTE':
        return '/panel';
      case 'TECNICO':
        return '/tecnico/ofertas';
      case 'ADMINISTRADOR':
      case 'CONTABLE':
        return '/admin/dashboard';
      case 'PROVEEDOR':
        return '/proveedor/panel';
      default:
        return '/login';
    }
  }
}
