import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  TecnicoResponse,
  OfertaTecnicoResponse,
  EstadoOperativo,
  OtResponse,
  DiagnosticoRequest,
  MedioPago,
  TipoDocumentoTecnico
} from '../../../core/shared/domain/models/common.models';
import {
  DocumentoTecnicoApiResponse,
  OfertaOtApiResponse,
  OtApiResponse,
  TecnicoApiResponse,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  aDiagnosticoApiRequest,
  aOfertaTecnico,
  aOtResponse,
  aTecnicoResponse,
} from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TecnicosApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  /** GET /api/tecnicos → TecnicoApiResponse[] traducido al modelo de vista. */
  getTecnicos(): Observable<TecnicoResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.tecnicos()).pipe(delay(250));
    }
    return this.http
      .get<TecnicoApiResponse[]>(this.apiConfig.url('/tecnicos'))
      .pipe(map(list => list.map(aTecnicoResponse)));
  }

  /**
   * Placeholder de composición: el backend NO expone GET /api/tecnicos/usuario/{id};
   * se resuelve listando GET /api/tecnicos y buscando por usuarioId.
   */
  getTecnicoPorUsuarioId(usuarioId: number): Observable<TecnicoResponse | undefined> {
    if (this.apiConfig.useMocks()) {
      const tec = this.mockDb.tecnicos().find(t => t.usuarioId === usuarioId);
      return of(tec).pipe(delay(150));
    }
    return this.http
      .get<TecnicoApiResponse[]>(this.apiConfig.url('/tecnicos'))
      .pipe(map(list => list.map(aTecnicoResponse).find(t => t.usuarioId === usuarioId)));
  }

  /**
   * GET /api/tecnicos/me/ofertas devuelve OfertaOtApiResponse[] SIN la OT anidada,
   * por eso se compone la unión real: por cada oferta se consulta GET /api/ot/{otId}
   * y se mapea con `aOfertaTecnico`. `tecnicoId` no lo usa el backend (sale del JWT).
   */
  getOfertasParaTecnico(tecnicoId: string): Observable<OfertaTecnicoResponse[]> {
    if (this.apiConfig.useMocks()) {
      const ofertas = this.mockDb.ofertas().filter(o => o.tecnicoId === tecnicoId && o.estado === 'PENDIENTE');
      return of(ofertas).pipe(delay(200));
    }
    return this.http.get<OfertaOtApiResponse[]>(this.apiConfig.url('/tecnicos/me/ofertas')).pipe(
      switchMap(ofertas => {
        if (ofertas.length === 0) {
          // forkJoin([]) completa sin emitir; se evita el caso degenerado.
          return of<OfertaTecnicoResponse[]>([]);
        }
        return forkJoin(
          ofertas.map(oferta =>
            this.http
              .get<OtApiResponse>(this.apiConfig.url(`/ot/${oferta.otId}`))
              .pipe(map(otDto => aOfertaTecnico(oferta, aOtResponse(otDto))))
          )
        );
      })
    );
  }

  /**
   * POST /api/ofertas/{ofertaId}/aceptar (sin body) → OtApiResponse; el backend
   * resuelve el técnico del principal. Una carrera perdida responde 409 y la
   * maneja el error interceptor.
   */
  aceptarOferta(ofertaId: string, tecnicoId: string): Observable<boolean> {
    if (this.apiConfig.useMocks()) {
      const ok = this.mockDb.aceptarOferta(ofertaId, tecnicoId);
      return of(ok).pipe(delay(300));
    }
    return this.http
      .post<OtApiResponse>(this.apiConfig.url(`/ofertas/${ofertaId}/aceptar`), null)
      .pipe(map(() => true));
  }

  /**
   * Placeholder de mutación: el backend NO expone POST /api/ot/{id}/aceptar.
   * TODO(backend): la aceptación es exclusiva de POST /api/ofertas/{id}/aceptar.
   */
  aceptarOt(otId: string, tecnicoId: string): Observable<OtResponse> {
    if (this.apiConfig.useMocks()) {
      const actualizada = this.mockDb.aceptarOt(otId, tecnicoId);
      return of(actualizada).pipe(delay(300));
    }
    return throwError(
      () =>
        new Error(
          'Pendiente en el backend: aceptación directa de OT (POST /api/ot/{id}/aceptar). Usar POST /api/ofertas/{id}/aceptar. TODO(backend).'
        )
    );
  }

  /**
   * PUT /api/tecnicos/{tecnicoId}/estado con {estadoOperativo} (el backend lee la
   * clave `estadoOperativo`, NO `estado`) → TecnicoApiResponse; la firma expone boolean.
   */
  cambiarEstadoOperativo(tecnicoId: string, nuevoEstado: EstadoOperativo): Observable<boolean> {
    if (this.apiConfig.useMocks()) {
      const res = this.mockDb.cambiarDisponibilidadTecnico(tecnicoId, nuevoEstado);
      return of(res).pipe(delay(200));
    }
    return this.http
      .put<TecnicoApiResponse>(this.apiConfig.url(`/tecnicos/${tecnicoId}/estado`), {
        estadoOperativo: nuevoEstado,
      })
      .pipe(map(() => true));
  }

  actualizarEstadoOperativo(tecnicoId: string, nuevoEstado: EstadoOperativo): Observable<boolean> {
    return this.cambiarEstadoOperativo(tecnicoId, nuevoEstado);
  }

  /** POST /api/ot/{otId}/iniciar-desplazamiento (sin cuerpo). */
  iniciarDesplazamiento(otId: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.avanzarEstadoOt(otId, 'EN_CAMINO', 'TECNICO', 'Técnico en ruta al domicilio del cliente');
      return of(undefined).pipe(delay(200));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/iniciar-desplazamiento`), null);
  }

  /**
   * No-op documentado: el backend NO expone POST /api/ot/{id}/llegada.
   * TODO(backend): la transición a EN_DIAGNOSTICO se alcanza al llamar a
   * `registrarDiagnostico` (POST /api/ot/{otId}/diagnostico).
   */
  llegarADomicilio(otId: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.avanzarEstadoOt(otId, 'EN_DIAGNOSTICO', 'TECNICO', 'Técnico ha llegado al domicilio y comienza diagnóstico');
      return of(undefined).pipe(delay(200));
    }
    return throwError(
      () =>
        new Error(
          'Pendiente en el backend: POST /api/ot/{id}/llegada (la OT pasa a EN_DIAGNOSTICO al registrar el diagnóstico). TODO(backend).'
        )
    );
  }

  /** POST /api/ot/{otId}/diagnostico con el body normalizado al contrato del backend. */
  registrarDiagnostico(otId: string, diag: DiagnosticoRequest): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.registrarDiagnostico(otId, diag);
      return of(undefined).pipe(delay(300));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/diagnostico`), aDiagnosticoApiRequest(diag));
  }

  /**
   * POST /api/ot/{otId}/finalizar (sin body; el backend lo ignora).
   * TODO(backend): el cobro real (efectivo/transferencia) se registra en
   * POST /api/liquidaciones/ot/{otId} con {montoCobrado, medioPago} (ver
   * LiquidacionApi.registrarPago); `firmaDataUrl` no tiene soporte en el backend.
   */
  finalizarServicio(otId: string, medioPago: MedioPago, firmaDataUrl?: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.finalizarOtConPago(otId, medioPago, firmaDataUrl);
      return of(undefined).pipe(delay(300));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/finalizar`), null);
  }

  /**
   * POST /api/tecnicos/{tecnicoId}/documentos con {tipo, fechaVencimiento}.
   * TODO(backend): el backend NO acepta `archivoUrl` en DocumentoTecnicoApiRequest,
   * así que la URL del archivo no se persiste.
   */
  subirDocumento(
    tecnicoId: string,
    tipo: TipoDocumentoTecnico,
    archivoUrl: string,
    fechaVencimiento?: string
  ): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.subirDocumentoTecnico(tecnicoId, tipo, archivoUrl, fechaVencimiento);
      return of(undefined).pipe(delay(300));
    }
    return this.http
      .post<DocumentoTecnicoApiResponse>(this.apiConfig.url(`/tecnicos/${tecnicoId}/documentos`), {
        tipo,
        fechaVencimiento,
      })
      .pipe(map(() => undefined));
  }
}
