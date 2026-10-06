import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { OtApi } from '../../core/service/ot-api';
import { Point, TarifaEstimadaResponse } from '../../core/models/common.models';

/**
 * Aviso del cargo "Visita y diagnóstico" que se notifica al cliente cuando el
 * técnico acepta la orden. La tarifa la calcula el backend por distancia
 * (POST /api/ot/tarifa/estimar): base metropolitana + brackets marginales,
 * con estado fuera de rango explícito. Reemplaza el cargo fijo 40.000 + 20.000.
 */
@Component({
  selector: 'app-cargo-visita',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cargo-visita.html',
})
export class CargoVisitaDiagnostico {
  private readonly otApi = inject(OtApi);

  readonly nota = input<string>(
    'Se cobra al confirmarse la asignación del técnico y no incluye la reparación. Si rechazas el presupuesto de reparación, este cargo por la visita y el diagnóstico ya fue prestado.'
  );

  /** Punto de servicio del cliente; con él se consulta la tarifa por distancia. */
  readonly punto = input<Point | undefined>(undefined);

  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  constructor() {
    effect(() => {
      const destino = this.punto();
      if (!destino) {
        this.estimacion.set(null);
        this.error.set(false);
        this.cargando.set(false);
        return;
      }
      this.cargando.set(true);
      this.error.set(false);
      this.otApi.estimarTarifa(destino).subscribe({
        next: (estimacion) => {
          this.estimacion.set(estimacion);
          this.cargando.set(false);
        },
        error: () => {
          this.estimacion.set(null);
          this.error.set(true);
          this.cargando.set(false);
        },
      });
    });
  }

  etiquetaFuente(fuente: TarifaEstimadaResponse['tarifaFuente']): string {
    return fuente === 'ROAD' ? 'Ruta por carretera' : 'Distancia lineal';
  }

  formato(valor: number): string {
    return '$ ' + valor.toLocaleString('es-CO');
  }
}
