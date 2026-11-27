import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OtApi } from '../../core/service/ot-api';
import { cargarOtDesdeRuta } from '../../core/service/ot-carga';
import { HistorialOtItem, OtResponse } from '../../core/models/common.models';
import { CargaError } from '../../shared/carga-error/carga-error';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { OtTimeline } from '../../shared/ot-timeline/ot-timeline';

/** Consulta de una OT para el equipo interno: solo lectura, sin acciones. */
@Component({
  selector: 'app-admin-ot-detalle-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, CargaError, EstadoBadge, OtTimeline],
  templateUrl: './admin-ot-detalle-page.html',
})
export class AdminOtDetallePage {
  private readonly otApi = inject(OtApi);

  readonly ot = signal<OtResponse | undefined>(undefined);
  readonly historial = signal<HistorialOtItem[]>([]);
  readonly errorHistorial = signal(false);

  readonly carga = cargarOtDesdeRuta(
    inject(ActivatedRoute),
    this.otApi,
    (id) => this.cargarHistorial(id),
    (ot) => this.ot.set(ot),
  );

  /** El historial es complementario: si falla, la OT se muestra igual. */
  private cargarHistorial(id: string): void {
    this.errorHistorial.set(false);
    this.otApi.getHistorial(id).subscribe({
      next: (items) => this.historial.set(items),
      error: () => this.errorHistorial.set(true),
    });
  }

  pesos(valor: number): string {
    return `$ ${valor.toLocaleString('es-CO')}`;
  }
}
