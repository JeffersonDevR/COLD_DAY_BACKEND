import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/service/admin-api';
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
  }

  cargarMetricas(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.adminApi.getMetricas().subscribe({
      next: (data) => {
        this.metricas.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.metricas.set(null);
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }
}
