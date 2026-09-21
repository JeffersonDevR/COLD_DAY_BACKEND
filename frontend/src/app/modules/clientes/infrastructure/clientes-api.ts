import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { DisputaResponse, OtRequest, OtResponse } from '../../../core/shared/domain/models/common.models';
import {
  ClienteApiRequest,
  ClienteApiResponse,
  DisputaApiResponse,
  OtApiResponse,
  UbicacionApiRequest,
} from '../../../core/shared/infrastructure/api/backend.dto';
import { aDisputaResponse, aOtApiRequest, aOtResponse } from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ClientesApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  /** POST /api/ot con el body normalizado al contrato del backend; el cliente sale del JWT. */
  crearOt(request: OtRequest, clienteId: string, clienteNombre: string): Observable<OtResponse> {
    if (this.apiConfig.useMocks()) {
      const nueva = this.mockDb.crearOt({
        clienteId,
        clienteNombre,
        categoriaServicio: request.categoriaServicio,
        descripcionFalla: request.descripcionFalla,
        direccion: request.direccion,
        barrio: request.barrio,
        latitud: request.latitud,
        longitud: request.longitud,
        evidenciaUrls: request.evidenciaUrls
      });
      return of(nueva).pipe(delay(400));
    }

    return this.http
      .post<OtApiResponse>(this.apiConfig.url('/ot'), aOtApiRequest(request))
      .pipe(map(aOtResponse));
  }

  /**
   * Placeholder: el backend NO expone un listado GET /api/ot?clienteId.
   * TODO(backend): falta el endpoint de OTs por cliente; se devuelve vacío para
   * no romper la UI (una lectura nunca lanza).
   */
  getOtsPorCliente(clienteId: string): Observable<OtResponse[]> {
    if (this.apiConfig.useMocks()) {
      const list = this.mockDb.ordenesTrabajo().filter(o => o.clienteId === clienteId);
      return of(list).pipe(delay(250));
    }

    console.warn('[TODO backend] GET /api/ot?clienteId no existe; se devuelve []');
    return of([]);
  }

  /** GET /api/ot/{id} → OtApiResponse traducido al modelo de vista. */
  getOtById(id: string): Observable<OtResponse | undefined> {
    if (this.apiConfig.useMocks()) {
      const ot = this.mockDb.ordenesTrabajo().find(o => o.id === id);
      return of(ot).pipe(delay(200));
    }

    return this.http.get<OtApiResponse>(this.apiConfig.url(`/ot/${id}`)).pipe(map(aOtResponse));
  }

  /** POST /api/ot/{id}/presupuesto/aprobar (sin body). */
  aprobarPresupuesto(id: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.aprobarPresupuesto(id);
      return of(undefined).pipe(delay(300));
    }

    return this.http.post<void>(this.apiConfig.url(`/ot/${id}/presupuesto/aprobar`), null);
  }

  aprobarDiagnostico(id: string): Observable<void> {
    return this.aprobarPresupuesto(id);
  }

  /** POST /api/ot/{id}/presupuesto/rechazar con {motivo}. */
  rechazarPresupuesto(id: string, motivo: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.rechazarPresupuesto(id, motivo);
      return of(undefined).pipe(delay(300));
    }

    return this.http.post<void>(this.apiConfig.url(`/ot/${id}/presupuesto/rechazar`), { motivo });
  }

  rechazarDiagnostico(id: string, motivo: string): Observable<void> {
    return this.rechazarPresupuesto(id, motivo);
  }

  /** POST /api/ot/{id}/cancelar con {motivo}. */
  cancelarOt(id: string, motivo: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.cancelarOt(id, motivo, 'CLIENTE');
      return of(undefined).pipe(delay(300));
    }

    return this.http.post<void>(this.apiConfig.url(`/ot/${id}/cancelar`), { motivo });
  }

  /**
   * Placeholder de mutación: el backend NO expone POST /api/ot/{id}/calificar.
   * TODO(backend): falta la calificación del servicio; la mutación lanza.
   */
  calificarServicio(otId: string, estrellas: number, comentario: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.calificarOt(otId, estrellas, comentario);
      return of(undefined).pipe(delay(300));
    }

    return throwError(
      () =>
        new Error(
          'Pendiente en el backend: calificación del servicio (POST /api/ot/{id}/calificar). TODO(backend).'
        )
    );
  }

  /**
   * POST /api/clientes: crea el perfil del cliente para el principal autenticado.
   * El backend NO acepta usuarioId en el body (lo resuelve del JWT).
   */
  crearCliente(request: ClienteApiRequest): Observable<ClienteApiResponse> {
    if (this.apiConfig.useMocks()) {
      const fake: ClienteApiResponse = {
        id: `cliente-mock-${Date.now()}`,
        usuarioId: 0,
        nombre: 'Cliente Demo',
        correo: 'cliente.demo@coldday.com.co',
        telefono: null,
        fotoUrl: null,
        tipoCliente: request.tipoCliente,
        direccion: {
          calle: request.calle,
          ciudad: request.ciudad,
          barrio: request.barrio ?? null,
          ubicacion: request.ubicacion ?? null,
        },
        activo: true,
      };
      return of(fake).pipe(delay(300));
    }

    return this.http.post<ClienteApiResponse>(this.apiConfig.url('/clientes'), request);
  }

  /**
   * PUT /api/clientes/me/ubicacion: el backend resuelve el cliente desde el JWT
   * (no se envía clienteId). Responde 204 sin cuerpo.
   */
  actualizarUbicacion(request: UbicacionApiRequest): Observable<void> {
    if (this.apiConfig.useMocks()) {
      return of(undefined).pipe(delay(250));
    }

    return this.http.put<void>(this.apiConfig.url('/clientes/me/ubicacion'), request);
  }

  /** POST /api/disputas/ot/{otId} con {motivo}: endpoint de disputa del rol CLIENTE. */
  abrirDisputa(otId: string, motivo: string): Observable<DisputaResponse> {
    if (this.apiConfig.useMocks()) {
      const fake: DisputaResponse = {
        id: `disputa-mock-${Date.now()}`,
        otId,
        motivo,
        estado: 'ABIERTA',
        fechaApertura: new Date().toISOString(),
      };
      return of(fake).pipe(delay(300));
    }

    return this.http
      .post<DisputaApiResponse>(this.apiConfig.url(`/disputas/ot/${otId}`), { motivo })
      .pipe(map(aDisputaResponse));
  }
}
