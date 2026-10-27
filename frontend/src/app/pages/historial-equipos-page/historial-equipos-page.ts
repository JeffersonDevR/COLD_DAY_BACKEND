import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/service/auth.service';
import { ClientesApi } from '../../core/service/clientes-api';
import { CategoriaServicio, EstadoOt, OtResponse } from '../../core/models/common.models';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { CargaError } from '../../shared/carga-error/carga-error';

/**
 * Un "equipo" del cliente: la categoría de servicio que ya fue intervenida,
 * derivada de sus órdenes de trabajo. El backend no expone una entidad de
 * equipo, así que la tarjeta agrupa por categoría y muestra la última OT.
 */
export interface EquipoCliente {
  categoria: CategoriaServicio;
  etiqueta: string;
  icono: string;
  /** Órdenes registradas para esa categoría. */
  intervenciones: number;
  ultimaOtId: string;
  codigoOt: string;
  descripcionFalla: string;
  estado: EstadoOt;
  /** Fecha de la última OT ya formateada (es-CO). */
  fecha: string;
}

const ETIQUETAS: Record<CategoriaServicio, string> = {
  AIRE_ACONDICIONADO: 'Aires acondicionados',
  REFRIGERACION: 'Refrigeración',
  LAVADORAS: 'Lavadoras',
  ELECTRICIDAD: 'Instalaciones eléctricas',
  CAMARAS_VIGILANCIA: 'Cámaras de vigilancia',
};

const ICONOS: Record<CategoriaServicio, string> = {
  AIRE_ACONDICIONADO: 'pi pi-sparkles',
  REFRIGERACION: 'pi pi-box',
  LAVADORAS: 'pi pi-refresh',
  ELECTRICIDAD: 'pi pi-bolt',
  CAMARAS_VIGILANCIA: 'pi pi-video',
};

@Component({
  selector: 'app-historial-equipos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyState, EstadoBadge, CargaError],
  templateUrl: './historial-equipos-page.html'
})
export class HistorialEquiposPage implements OnInit {
  readonly authService = inject(AuthService);
  private readonly clientesApi = inject(ClientesApi);
  private readonly router = inject(Router);

  private readonly ots = signal<OtResponse[]>([]);
  /** Carga silenciosa: el fallo se ve y se puede reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  readonly equipos = computed<EquipoCliente[]>(() => this.agrupar(this.ots()));

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.clientesApi.getOtsPorCliente(String(this.authService.currentUser()?.id ?? '')).subscribe({
      next: (ots) => {
        this.ots.set(ots);
        this.cargando.set(false);
      },
      error: () => {
        this.ots.set([]);
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }

  solicitarServicio(): void {
    this.router.navigate(['/cliente/solicitar']);
  }

  /** Agrupa por categoría y deja primero la última intervención. */
  private agrupar(ots: OtResponse[]): EquipoCliente[] {
    const porCategoria = new Map<CategoriaServicio, OtResponse[]>();
    for (const ot of ots) {
      const lista = porCategoria.get(ot.categoriaServicio) ?? [];
      lista.push(ot);
      porCategoria.set(ot.categoriaServicio, lista);
    }

    return Array.from(porCategoria.entries())
      .map(([categoria, ordenes]) => {
        const ultima = [...ordenes].sort((a, b) => this.fechaMs(b.fechaCreacion) - this.fechaMs(a.fechaCreacion))[0];
        return {
          ms: this.fechaMs(ultima.fechaCreacion),
          equipo: {
            categoria,
            etiqueta: ETIQUETAS[categoria] ?? categoria.replace('_', ' '),
            icono: ICONOS[categoria] ?? 'pi pi-box',
            intervenciones: ordenes.length,
            ultimaOtId: ultima.id,
            codigoOt: ultima.codigo ?? 'Sin código',
            descripcionFalla: ultima.descripcionFalla,
            estado: ultima.estado,
            fecha: this.formatear(ultima.fechaCreacion),
          } satisfies EquipoCliente,
        };
      })
      .sort((a, b) => b.ms - a.ms)
      .map(({ equipo }) => equipo);
  }

  private fechaMs(fecha?: string): number {
    const ms = fecha ? Date.parse(fecha) : Number.NaN;
    return Number.isNaN(ms) ? 0 : ms;
  }

  private formatear(fecha?: string): string {
    const ms = this.fechaMs(fecha);
    if (!ms) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ms));
  }}
