import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SolicitudPerfilApiRequest } from '../models/backend.dto';
import { ApiConfig } from './api.config';

/**
 * Flujo de solicitud de perfil (PQRS) compartido entre web y móvil.
 *
 * `POST /api/solicitudes-perfil` es el único endpoint que usa la app móvil;
 * la bandeja `GET /api/admin/solicitudes-perfil` es solo de la consola web.
 * El usuario se resuelve desde el principal autenticado, así que el body no
 * lleva identificadores.
 */
@Injectable({
  providedIn: 'root'
})
export class SolicitudesPerfilApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);

  /**
   * `POST /api/solicitudes-perfil`: 201 al crear, 409 si ya hay una solicitud
   * abierta para el mismo perfil, 422 si el perfil pedido es el rol inicial.
   * Los errores se propagan sin traducir para que la pantalla elija su copy.
   */
  solicitar(request: SolicitudPerfilApiRequest): Observable<void> {
    return this.http.post<void>(this.apiConfig.url('/solicitudes-perfil'), request);
  }
}
