import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  OtResponse,
  DiagnosticoRequest,
  MedioPago,
  ActorOt,
  HistorialOtItem,
} from '../../../core/shared/domain/models/common.models';
import {
  HistorialEstadoApiResponse,
  OtApiResponse,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  aDiagnosticoApiRequest,
  aHistorialOtItem,
  aOtResponse,
} from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OtApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  /** GET /api/ot/{id} → OtApiResponse traducido al modelo de vista. */
  getOtById(id: string): Observable<OtResponse | undefined> {
    if (this.apiConfig.useMocks()) {
      const ot = this.mockDb.ordenesTrabajo().find(o => o.id === id);
      return of(ot).pipe(delay(150));
    }
    return this.http.get<OtApiResponse>(this.apiConfig.url(`/ot/${id}`)).pipe(map(aOtResponse));
  }

  /** POST /api/ot/{otId}/iniciar-desplazamiento (sin cuerpo) → void. */
  iniciarDesplazamiento(otId: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.avanzarEstadoOt(otId, 'EN_CAMINO', 'TECNICO', 'Técnico ha iniciado desplazamiento hacia el domicilio');
      return of(undefined).pipe(delay(250));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/iniciar-desplazamiento`), null);
  }

  /**
   * No-op documentado: el backend NO expone POST /api/ot/{id}/iniciar-diagnostico.
   * TODO(backend): la transición a EN_DIAGNOSTICO se alcanza al llamar a
   * `registrarDiagnostico` (POST /api/ot/{otId}/diagnostico).
   */
  iniciarDiagnostico(otId: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.avanzarEstadoOt(otId, 'EN_DIAGNOSTICO', 'TECNICO', 'Técnico se encuentra en sitio realizando diagnóstico inicial');
      return of(undefined).pipe(delay(250));
    }
    return throwError(
      () =>
        new Error(
          'Pendiente en el backend: POST /api/ot/{id}/iniciar-diagnostico (la OT pasa a EN_DIAGNOSTICO al registrar el diagnóstico). TODO(backend).'
        )
    );
  }

  /** POST /api/ot/{otId}/diagnostico con el body normalizado al contrato del backend. */
  registrarDiagnostico(otId: string, diag: DiagnosticoRequest): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.registrarDiagnostico(otId, diag);
      return of(undefined).pipe(delay(350));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/diagnostico`), aDiagnosticoApiRequest(diag));
  }

  /**
   * POST /api/ot/{otId}/finalizar (sin body; el backend lo ignora).
   * TODO(backend): el cobro real (efectivo/transferencia) se registra en
   * POST /api/liquidaciones/ot/{otId} con {montoCobrado, medioPago} (ver
   * LiquidacionApi.registrarPago); `firmaDataUrl` no tiene soporte en el backend.
   */
  finalizarOt(otId: string, medioPago: MedioPago, firmaDataUrl?: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.finalizarOtConPago(otId, medioPago, firmaDataUrl);
      return of(undefined).pipe(delay(400));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/finalizar`), null);
  }

  /** POST /api/ot/{otId}/cancelar con {motivo}; el actor lo resuelve el backend del principal. */
  cancelarOt(otId: string, motivo: string, actor: ActorOt): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.cancelarOt(otId, motivo, actor);
      return of(undefined).pipe(delay(300));
    }
    return this.http.post<void>(this.apiConfig.url(`/ot/${otId}/cancelar`), { motivo });
  }

  /** GET /api/ot/{otId}/historial → HistorialEstadoApiResponse[] traducido al modelo de vista. */
  getHistorial(otId: string): Observable<HistorialOtItem[]> {
    if (this.apiConfig.useMocks()) {
      // El mock DB no mantiene historial de estados.
      return of([]).pipe(delay(150));
    }
    return this.http
      .get<HistorialEstadoApiResponse[]>(this.apiConfig.url(`/ot/${otId}/historial`))
      .pipe(map(list => list.map(aHistorialOtItem)));
  }
}
