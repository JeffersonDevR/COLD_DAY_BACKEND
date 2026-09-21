import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  LiquidacionResponse,
  MedioPago,
} from '../../../core/shared/domain/models/common.models';
import {
  ComprobanteApiRequest,
  LiquidacionApiResponse,
  RechazoLiquidacionApiRequest,
  RegistrarPagoApiRequest,
} from '../../../core/shared/infrastructure/api/backend.dto';
import { environment } from '../../../../environments/environment';
import { aLiquidacionResponse } from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class LiquidacionApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  getLiquidacionesPorTecnico(tecnicoId: string): Observable<LiquidacionResponse[]> {
    if (this.apiConfig.useMocks()) {
      const list = this.mockDb.liquidaciones().filter(l => l.tecnicoId === tecnicoId);
      return of(list).pipe(delay(200));
    }
    // GET /api/tecnicos/me/liquidaciones: el backend resuelve el técnico del JWT.
    return this.http
      .get<LiquidacionApiResponse[]>(this.apiConfig.url('/tecnicos/me/liquidaciones'))
      .pipe(map(list => list.map(aLiquidacionResponse)));
  }

  getLiquidacionesPendientesAdmin(): Observable<LiquidacionResponse[]> {
    if (this.apiConfig.useMocks()) {
      const list = this.mockDb
        .liquidaciones()
        .filter(l => l.estado === 'PENDIENTE_CONSIGNACION' || l.estado === 'EN_VERIFICACION');
      return of(list).pipe(delay(200));
    }
    return this.http
      .get<LiquidacionApiResponse[]>(this.apiConfig.url('/admin/liquidaciones/pendientes'))
      .pipe(map(list => list.map(aLiquidacionResponse)));
  }

  getTodasLiquidaciones(): Observable<LiquidacionResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.liquidaciones()).pipe(delay(200));
    }
    return this.http
      .get<LiquidacionApiResponse[]>(this.apiConfig.url('/admin/liquidaciones'))
      .pipe(map(list => list.map(aLiquidacionResponse)));
  }

  subirComprobante(liqId: string, comprobanteUrl: string, referencia: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.subirComprobanteLiquidacion(liqId, comprobanteUrl, referencia);
      return of(undefined).pipe(delay(300));
    }
    // Pendiente(backend): el backend NO acepta `referencia`; solo persiste `comprobanteUrl`.
    const body: ComprobanteApiRequest = { comprobanteUrl };
    return this.http.post<void>(this.apiConfig.url(`/liquidaciones/${liqId}/comprobante`), body);
  }

  aprobarLiquidacion(liqId: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.aprobarLiquidacion(liqId);
      return of(undefined).pipe(delay(300));
    }
    return this.http.post<void>(this.apiConfig.url(`/admin/liquidaciones/${liqId}/aprobar`), null);
  }

  rechazarLiquidacion(liqId: string, motivo: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.rechazarLiquidacion(liqId, motivo);
      return of(undefined).pipe(delay(300));
    }
    const body: RechazoLiquidacionApiRequest = { motivo };
    return this.http.post<void>(this.apiConfig.url(`/admin/liquidaciones/${liqId}/rechazar`), body);
  }

  /**
   * POST /api/liquidaciones/ot/{otId} con {montoCobrado, medioPago}.
   * Es el registro del recaudo del técnico (efectivo/transferencia) al cierre;
   * el backend exige `montoCobrado >= 0.01`.
   */
  registrarPago(
    otId: string,
    montoCobrado: number,
    medioPago: MedioPago
  ): Observable<LiquidacionResponse> {
    if (this.apiConfig.useMocks()) {
      const fecha = new Date().toISOString();
      const liquidacion: LiquidacionResponse = {
        id: `LIQ-${otId}`,
        otId,
        tecnicoId: `TEC-${otId}`,
        montoServicio: montoCobrado,
        comision: Math.round(montoCobrado * environment.commissionRate),
        estado: 'PENDIENTE_CONSIGNACION',
        medioPago,
        fechaRegistro: fecha,
        fechaCreacion: fecha,
      };
      return of(liquidacion).pipe(delay(300));
    }
    const body: RegistrarPagoApiRequest = { montoCobrado, medioPago };
    return this.http
      .post<LiquidacionApiResponse>(this.apiConfig.url(`/liquidaciones/ot/${otId}`), body)
      .pipe(map(aLiquidacionResponse));
  }
}
