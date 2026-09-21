import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { aUsuarioResponse } from '../../../core/shared/infrastructure/api/backend.mappers';
import {
  TokenApiResponse,
  UsuarioApiRequest,
  UsuarioApiResponse,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  TokenResponse,
  UsuarioRequest,
  UsuarioResponse,
} from '../../../core/shared/domain/models/common.models';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  /**
   * POST /api/usuarios/login → {token, expiracion, rol}.
   * El backend no devuelve el perfil: la sesión se reconstruye desde los claims
   * del JWT (ver AuthService.establecerSesionDesdeToken).
   */
  login(correo: string, password: string): Observable<TokenResponse> {
    if (this.apiConfig.useMocks()) {
      const user = this.mockDb.usuarios().find(u => u.correo.toLowerCase() === correo.toLowerCase());
      if (user) {
        // En mock se acepta demo1234 o cualquier pass si el usuario existe
        return of({
          token: 'mock-jwt-token-' + user.id,
          expiracion: new Date(Date.now() + 86400000 * 7).toISOString(),
          rol: user.rol,
          usuario: user
        }).pipe(delay(300));
      }
      return throwError(() => new Error('Credenciales inválidas. Verifica tu correo y contraseña.'));
    }

    return this.http.post<TokenApiResponse>(this.apiConfig.url('/usuarios/login'), { correo, password });
  }

  /** POST /api/usuarios → UsuarioApiResponse (se traduce al modelo de vista). */
  registro(request: UsuarioRequest): Observable<UsuarioResponse> {
    if (this.apiConfig.useMocks()) {
      const id = this.mockDb.usuarios().length + 1;
      const nuevo: UsuarioResponse = {
        id,
        nombre: request.nombre,
        correo: request.correo,
        telefono: request.telefono,
        rol: request.rol,
        habeasDataAceptado: request.aceptaHabeasData,
        activo: true,
        fechaRegistro: new Date().toISOString().slice(0, 10)
      };
      this.mockDb.usuarios.update(u => [...u, nuevo]);
      return of(nuevo).pipe(delay(300));
    }

    const body: UsuarioApiRequest = {
      nombre: request.nombre,
      correo: request.correo,
      password: request.password,
      telefono: request.telefono,
      fotoUrl: request.fotoUrl,
      rol: request.rol,
      aceptaHabeasData: request.aceptaHabeasData,
    };

    return this.http
      .post<UsuarioApiResponse>(this.apiConfig.url('/usuarios'), body)
      .pipe(map(aUsuarioResponse));
  }

  /**
   * POST /api/usuarios/recuperar-contrasena → 202 sin cuerpo.
   * Se sintetiza un mensaje para la UI porque el backend no devuelve body.
   */
  solicitarRecuperacion(correo: string): Observable<{ mensaje: string; tokenSimulado?: string }> {
    if (this.apiConfig.useMocks()) {
      return of({
        mensaje: 'Se ha enviado un correo con instrucciones de restablecimiento.',
        tokenSimulado: 'CD-RESET-' + Math.floor(100000 + Math.random() * 900000)
      }).pipe(delay(400));
    }
    return this.http
      .post<void>(this.apiConfig.url('/usuarios/recuperar-contrasena'), { correo })
      .pipe(map(() => ({ mensaje: 'Se envió un correo con las instrucciones de restablecimiento.' })));
  }

  /**
   * POST /api/usuarios/reset-contrasena → 204.
   * OJO: el backend espera el campo `nuevaPassword` (no `nuevaPass`).
   */
  resetPassword(token: string, nuevaPass: string): Observable<{ mensaje: string }> {
    if (this.apiConfig.useMocks()) {
      return of({ mensaje: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' }).pipe(delay(300));
    }
    return this.http
      .post<void>(this.apiConfig.url('/usuarios/reset-contrasena'), { token, nuevaPassword: nuevaPass })
      .pipe(map(() => ({ mensaje: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' })));
  }
}
