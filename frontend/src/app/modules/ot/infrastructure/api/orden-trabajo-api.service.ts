import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ActorOt } from '../../domain/models/estado-ot.model';
import {
  CrearOrdenTrabajoRequest,
  DiagnosticoRequest,
  HistorialEstado,
  OrdenTrabajo,
} from '../../domain/models/orden-trabajo.model';

/**
 * Acceso HTTP real al recurso /api/ot. En el prototipo el flujo consume
 * OtMockService; al pasar `environment.useMocks` a false conviene exponer este
 * servicio detras de la misma interfaz que el mock.
 */
@Injectable({
  providedIn: 'root',
})
export class OrdenTrabajoApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ot`;

  obtenerPorId(id: string): Observable<OrdenTrabajo> {
    return this.http.get<OrdenTrabajo>(`${this.baseUrl}/${id}`);
  }

  obtenerHistorial(id: string): Observable<HistorialEstado[]> {
    return this.http.get<HistorialEstado[]>(`${this.baseUrl}/${id}/historial`);
  }

  crear(request: CrearOrdenTrabajoRequest): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(this.baseUrl, request);
  }

  iniciarDesplazamiento(id: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/iniciar-desplazamiento`, {});
  }

  registrarDiagnostico(id: string, request: DiagnosticoRequest): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/diagnostico`, request);
  }

  aprobarPresupuesto(id: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/presupuesto/aprobar`, {});
  }

  rechazarPresupuesto(id: string, motivo?: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/presupuesto/rechazar`, { motivo });
  }

  finalizar(id: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/finalizar`, {});
  }

  cancelar(id: string, actor: ActorOt, motivo: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.baseUrl}/${id}/cancelar`, { actor, motivo });
  }
}
