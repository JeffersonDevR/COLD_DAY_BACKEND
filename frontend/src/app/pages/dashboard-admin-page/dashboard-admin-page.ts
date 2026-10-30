import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { AdminApi } from '../../core/service/admin-api';
import { refrescarConActividadAdmin } from '../../core/service/admin-actividad-refresco';
import { SseService } from '../../core/service/sse.service';
import { CategoriaServicio, MetricasAdminResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';
import { CargaError } from '../../shared/carga-error/carga-error';

@Component({
  selector: 'app-dashboard-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CargaError],
  templateUrl: './dashboard-admin-page.html'
})
export class DashboardAdminPage implements OnInit {
  private readonly adminApi = inject(AdminApi);
  /** Canal admin; `null` sin backend SSE (mock/SSR/specs): la torre sigue igual. */
  private readonly sse = inject(SseService, { optional: true });
  private readonly destruir = inject(DestroyRef);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);
  readonly metricas = signal<MetricasAdminResponse | null>(null);

  /** Carga silenciosa: si las métricas no llegan, la torre lo dice y reintenta. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  private readonly coloresCategoria: Record<CategoriaServicio, string> = {
    CAMARAS_VIGILANCIA: '#8b5cf6',
    AIRE_ACONDICIONADO: '#0284c7',
    REFRIGERACION: '#06b6d4',
    ELECTRICIDAD: '#f59e0b',
    LAVADORAS: '#10b981',
  };

  /** Segmentos de la dona calculados a partir de la distribución real. */
  readonly distribucion = computed(() => {
    const metricas = this.metricas();
    if (!metricas) {
      return [];
    }
    const perimetro = 2 * Math.PI * 38;
    let acumulado = 0;
    return metricas.distribucionCategorias.map((d) => {
      const largo = (d.porcentaje / 100) * perimetro;
      const segmento = {
        categoria: d.categoria,
        porcentaje: d.porcentaje,
        color: this.coloresCategoria[d.categoria] ?? '#64748b',
        label: d.categoria.replace('_', ' '),
        dasharray: `${largo} ${perimetro}`,
        dashoffset: `${-acumulado}`,
      };
      acumulado += largo;
      return segmento;
    });
  });

  readonly totalServicios = computed(() =>
    (this.metricas()?.distribucionCategorias ?? []).reduce((total, d) => total + d.cantidad, 0)
  );

  ngOnInit(): void {
    this.cargarMetricas();
    // Cualquier actividad administrativa cambia algún número de la torre.
    refrescarConActividadAdmin({
      sse: this.sse,
      destruir: this.destruir,
      tipos: 'todos',
      recargar: () => this.recargarMetricas(),
    });
  }

  cargarMetricas(): void {
    this.recargarMetricas().subscribe();
  }

  /** Carga las métricas y expone su final para no solapar dos recargas. */
  private recargarMetricas(): Observable<unknown> {
    this.cargando.set(true);
    this.errorCarga.set(false);
    return this.adminApi.getMetricas().pipe(
      tap((data) => this.metricas.set(data)),
      catchError(() => {
        this.metricas.set(null);
        this.errorCarga.set(true);
        return of(null);
      }),
      finalize(() => this.cargando.set(false)),
    );
  }
}
