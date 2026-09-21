import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import {
  MetricasAdminResponse,
  DisputaResponse,
  EstadoValidacion,
  OtResponse,
} from '../../../core/shared/domain/models/common.models';
import {
  DisputaApiResponse,
  MetricasAdminApiResponse,
  OtApiResponse,
  ResolverDisputaApiRequest,
  ValidacionTecnicoApiRequest,
} from '../../../core/shared/infrastructure/api/backend.dto';
import {
  aDisputaResponse,
  aMetricasAdmin,
  aOtResponse,
} from '../../../core/shared/infrastructure/api/backend.mappers';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  getMetricas(): Observable<MetricasAdminResponse> {
    if (this.apiConfig.useMocks()) {
      const ots = this.mockDb.ordenesTrabajo();
      const tecnicos = this.mockDb.tecnicos();
      const liquidaciones = this.mockDb.liquidaciones();
      const disputas = this.mockDb.disputas();

      const serviciosEnEjecucion = ots.filter(o =>
        ['ASIGNADA', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(o.estado)
      ).length;

      const tecnicosVerificados = tecnicos.filter(t => t.estadoValidacion === 'APROBADO').length;
      const tecnicosDisponibles = tecnicos.filter(t => t.estadoOperativo === 'DISPONIBLE').length;

      const totalRecaudo = liquidaciones.reduce((acc, l) => acc + l.montoServicio, 0);
      const totalComisiones = liquidaciones.reduce((acc, l) => acc + l.comision, 0);

      const metricas: MetricasAdminResponse = {
        serviciosEnEjecucion,
        tecnicosVerificados,
        tecnicosDisponibles,
        tiempoPromedioRespuestaMin: 14,
        incidenciasActivas: disputas.filter(d => d.estado === 'ABIERTA').length,
        totalRecaudoMesCop: totalRecaudo + 4850000,
        comisionesMesCop: totalComisiones + 485000,
        distribucionCategorias: [
          { categoria: 'AIRE_ACONDICIONADO', cantidad: 38, porcentaje: 45 },
          { categoria: 'REFRIGERACION', cantidad: 25, porcentaje: 30 },
          { categoria: 'ELECTRICIDAD', cantidad: 12, porcentaje: 15 },
          { categoria: 'ELECTRODOMESTICOS', cantidad: 8, porcentaje: 10 }
        ],
        historicoSemanal: [
          { dia: 'Lun', completadas: 8, canceladas: 1 },
          { dia: 'Mar', completadas: 12, canceladas: 0 },
          { dia: 'Mié', completadas: 10, canceladas: 2 },
          { dia: 'Jue', completadas: 15, canceladas: 1 },
          { dia: 'Vie', completadas: 18, canceladas: 0 },
          { dia: 'Sáb', completadas: 14, canceladas: 1 },
          { dia: 'Dom', completadas: 6, canceladas: 0 }
        ]
      };

      return of(metricas).pipe(delay(250));
    }

    return this.http
      .get<MetricasAdminApiResponse>(this.apiConfig.url('/admin/metricas'))
      .pipe(map(aMetricasAdmin));
  }

  /** GET /api/admin/ot → listado global de OTs para monitoreo. */
  getTodasOts(): Observable<OtResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.ordenesTrabajo()).pipe(delay(250));
    }
    return this.http
      .get<OtApiResponse[]>(this.apiConfig.url('/admin/ot'))
      .pipe(map(list => list.map(aOtResponse)));
  }

  getDisputasAbiertas(): Observable<DisputaResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.disputas().filter(d => d.estado === 'ABIERTA')).pipe(delay(200));
    }
    return this.http
      .get<DisputaApiResponse[]>(this.apiConfig.url('/admin/disputas/abiertas'))
      .pipe(map(list => list.map(aDisputaResponse)));
  }

  getTodasDisputas(): Observable<DisputaResponse[]> {
    if (this.apiConfig.useMocks()) {
      return of(this.mockDb.disputas()).pipe(delay(200));
    }
    return this.http
      .get<DisputaApiResponse[]>(this.apiConfig.url('/admin/disputas'))
      .pipe(map(list => list.map(aDisputaResponse)));
  }

  resolverDisputa(disputaId: string, resolucion: string, acuerdo: boolean, adminNombre: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.resolverDisputa(disputaId, resolucion, acuerdo, adminNombre);
      return of(undefined).pipe(delay(300));
    }
    // Pendiente(backend): el backend resuelve el admin desde el principal autenticado;
    // la clave del body es `conAcuerdo`, NO `acuerdo`. `adminNombre` no se envía.
    const body: ResolverDisputaApiRequest = { conAcuerdo: acuerdo, resolucion };
    return this.http.post<void>(this.apiConfig.url(`/admin/disputas/${disputaId}/resolver`), body);
  }

  validarDocumentacionTecnico(tecnicoId: string, nuevoEstado: EstadoValidacion, motivo?: string): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.validarTecnico(tecnicoId, nuevoEstado, motivo);
      return of(undefined).pipe(delay(300));
    }
    // Pendiente(backend): el backend aprueba SOLO con la acción literal "APROBAR";
    // cualquier otro valor rechaza. `motivo` solo se envía cuando viene informado.
    const body: ValidacionTecnicoApiRequest = {
      accion: nuevoEstado === 'APROBADO' ? 'APROBAR' : 'RECHAZAR',
    };
    if (motivo) {
      body.motivo = motivo;
    }
    return this.http.patch<void>(this.apiConfig.url(`/tecnicos/${tecnicoId}/validacion`), body);
  }
}
