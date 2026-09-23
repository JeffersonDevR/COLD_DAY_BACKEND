import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  OfertaInsumoResponse,
  SolicitudInsumoResponse,
} from '../../../core/shared/domain/models/common.models';
import {
  OfertaInsumoApiResponse,
  SolicitudInsumoApiResponse,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  aOfertaInsumoResponse,
  aSolicitudInsumoResponse,
} from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

/**
 * Fachada del portal del proveedor (rol PROVEEDOR). Consume el despacho de
 * insumos: listado de ofertas vigentes y las tres acciones del ciclo de vida.
 *
 * En modo mock delega en MockDbService conservando los mismos contratos y los
 * mismos errores de dominio (409 solicitud tomada, 404 no disponible, 403 no
 * elegible) para que la UI se pruebe end to end sin backend.
 */
@Injectable({
  providedIn: 'root'
})
export class ProveedoresApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  /** GET /api/proveedores/me/solicitudes → ofertas con su requerimiento embebido. */
  getMisSolicitudes(): Observable<OfertaInsumoResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.solicitudesProveedor()).pipe(delay(250));
    }
    return this.http
      .get<OfertaInsumoApiResponse[]>(this.apiConfig.url('/proveedores/me/solicitudes'))
      .pipe(map((list) => list.map(aOfertaInsumoResponse)));
  }

  /**
   * POST /api/insumos/{ofertaId}/aceptar → requerimiento `ASIGNADO`.
   * Una carrera perdida responde 409 y una oferta ajena/no vigente 404/409.
   */
  aceptar(ofertaId: string): Observable<SolicitudInsumoResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.aceptarInsumo(ofertaId)).pipe(delay(300));
    }
    return this.http
      .post<SolicitudInsumoApiResponse>(this.apiConfig.url(`/insumos/${ofertaId}/aceptar`), null)
      .pipe(map(aSolicitudInsumoResponse));
  }

  /** POST /api/insumos/{ofertaId}/rechazar → oferta `RECHAZADO`, sin vincular. */
  rechazar(ofertaId: string): Observable<OfertaInsumoResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.rechazarInsumo(ofertaId)).pipe(delay(300));
    }
    return this.http
      .post<OfertaInsumoApiResponse>(this.apiConfig.url(`/insumos/${ofertaId}/rechazar`), null)
      .pipe(map(aOfertaInsumoResponse));
  }

  /**
   * POST /api/insumos/{id}/entregar → requerimiento `ENTREGADO`.
   * Solo el proveedor cuya oferta está `ACEPTADA` puede confirmar la entrega.
   */
  entregar(requerimientoId: string): Observable<SolicitudInsumoResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.entregarInsumo(requerimientoId)).pipe(delay(300));
    }
    return this.http
      .post<SolicitudInsumoApiResponse>(this.apiConfig.url(`/insumos/${requerimientoId}/entregar`), null)
      .pipe(map(aSolicitudInsumoResponse));
  }
}
