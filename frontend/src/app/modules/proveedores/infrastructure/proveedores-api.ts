import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  DocumentoProveedorResponse,
  OfertaInsumoResponse,
  ProveedorRequest,
  ProveedorResponse,
  SolicitudInsumoResponse,
} from '../../../core/shared/domain/models/common.models';
import {
  DocumentoProveedorApiResponse,
  OfertaInsumoApiResponse,
  ProveedorApiRequest,
  ProveedorApiResponse,
  SolicitudInsumoApiResponse,
  ValidacionProveedorApiRequest,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  aOfertaInsumoResponse,
  aProveedorResponse,
  aSolicitudInsumoResponse,
} from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, defer, of } from 'rxjs';
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

  /**
   * POST /api/proveedores: alta publica y atomica (crea el Usuario rol PROVEEDOR
   * y el perfil en una sola transaccion), igual que POST /api/clientes y
   * POST /api/tecnicos.
   *
   * El request NO lleva `rol`: lo deriva el servidor. Y la respuesta siempre
   * trae `estadoValidacion: 'PENDIENTE'`, porque V8 dejo la columna sin DEFAULT
   * y `Proveedor.crear` la declara explicitamente. Un proveedor recien
   * registrado no puede aceptar insumos hasta que un administrador lo aprueba.
   */
  registrar(req: ProveedorRequest): Observable<ProveedorResponse> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.crearProveedor(req)).pipe(delay(300));
    }
    const body: ProveedorApiRequest = req;
    return this.http
      .post<ProveedorApiResponse>(this.apiConfig.url('/proveedores'), body)
      .pipe(map(aProveedorResponse));
  }

  /**
   * GET /api/proveedores/me/documentos: el backend resuelve el proveedor desde
   * el JWT, asi que esta llamada solo puede devolver el expediente propio.
   */
  getMisDocumentos(): Observable<DocumentoProveedorResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.documentosDe(this.mockDb.proveedorEnSesion())).pipe(delay(250));
    }
    return this.http
      .get<DocumentoProveedorApiResponse[]>(this.apiConfig.url('/proveedores/me/documentos'))
      .pipe(map(list => list.map(doc => ({ ...doc, fechaVencimiento: doc.fechaVencimiento ?? undefined }))));
  }

  /**
   * POST /api/proveedores/me/documentos: declara un documento del expediente.
   * Metadata-only (tipo + vencimiento): no hay archivo ni upload, y por eso no
   * se envia nada mas.
   */
  registrarDocumento(tipo: string, fechaVencimiento?: string): Observable<DocumentoProveedorResponse> {
    if (this.apiConfig.useMocks()) {
      const enSesion = this.mockDb.proveedorEnSesion();
      return of(this.mockDb.registrarDocumentoProveedor(enSesion, tipo, fechaVencimiento)).pipe(delay(300));
    }
    return this.http
      .post<DocumentoProveedorApiResponse>(this.apiConfig.url('/proveedores/me/documentos'),
        { tipo, fechaVencimiento: fechaVencimiento ?? null })
      .pipe(map(doc => ({ ...doc, fechaVencimiento: doc.fechaVencimiento ?? undefined })));
  }

  /**
   * GET /api/proveedores/{id}/documentos: expediente de un proveedor puntual para
   * que un administrador lo revise antes de aprobar o rechazar su validacion.
   * El mock no tiene expedientes por proveedor arbitrario, asi que responde un
   * arreglo vacio; el alta y la consulta propia usan getMisDocumentos.
   */
  getDocumentos(proveedorId: string): Observable<DocumentoProveedorApiResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of([]).pipe(delay(250));
    }
    return this.http.get<DocumentoProveedorApiResponse[]>(
      this.apiConfig.url(`/proveedores/${proveedorId}/documentos`));
  }

  /**
   * PATCH /api/proveedores/{id}/validacion → aprueba o rechaza el expediente.
   * El backend resuelve el proveedor por el id del path y exige rol ADMINISTRADOR;
   * responde 204, por eso el Observable emite void. `motivo` solo viaja cuando
   * viene informado (el rechazo lo lleva; la aprobacion no).
   */
  validarDocumentacion(proveedorId: string, accion: 'APROBAR' | 'RECHAZAR', motivo?: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      // El mock no modela el estado de validacion del proveedor: no-op documentado.
      return of(undefined).pipe(delay(300));
    }
    const body: ValidacionProveedorApiRequest = { accion };
    if (motivo) {
      body.motivo = motivo;
    }
    return this.http.patch<void>(this.apiConfig.url(`/proveedores/${proveedorId}/validacion`), body);
  }

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
      return defer(() => of(this.mockDb.aceptarInsumo(ofertaId))).pipe(delay(300));
    }
    return this.http
      .post<SolicitudInsumoApiResponse>(this.apiConfig.url(`/insumos/${ofertaId}/aceptar`), null)
      .pipe(map(aSolicitudInsumoResponse));
  }

  /** POST /api/insumos/{ofertaId}/rechazar → oferta `RECHAZADO`, sin vincular. */
  rechazar(ofertaId: string): Observable<OfertaInsumoResponse> {
    if (this.apiConfig.useMocks()) {
      return defer(() => of(this.mockDb.rechazarInsumo(ofertaId))).pipe(delay(300));
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
      return defer(() => of(this.mockDb.entregarInsumo(requerimientoId))).pipe(delay(300));
    }
    return this.http
      .post<SolicitudInsumoApiResponse>(this.apiConfig.url(`/insumos/${requerimientoId}/entregar`), null)
      .pipe(map(aSolicitudInsumoResponse));
  }
}
