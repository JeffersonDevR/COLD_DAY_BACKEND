import { Signal, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiConfig } from './api.config';
import { MockDbService } from './mock-db.service';
import { mensajeErrorAccion } from '../alertas/mensaje-error';
import { OtResponse } from '../models/common.models';
import { OtApi } from './ot-api';

/**
 * Fuente reactiva de la OT: en modo mock lee del MockDb (reactivo); contra el
 * backend usa la OT cargada por API. Evita repetir el mismo `computed` en cada
 * página de seguimiento/ejecución.
 */
export function otDesdeFuente(
  apiConfig: ApiConfig,
  mockDb: MockDbService,
  otId: Signal<string>,
  remoto: Signal<OtResponse | undefined>,
): Signal<OtResponse | undefined> {
  return computed(() => {
    if (apiConfig.useMocks()) {
      return mockDb.ordenesTrabajo().find((o) => o.id === otId());
    }
    return remoto();
  });
}

/**
 * Estado de la carga de la OT visible desde la página: el fallo dejó de ser
 * mudo, el `next`-only de `ot-carga` dejaba la pantalla ENTERA en blanco.
 * `reintentar` repite la carga del último id resuelto de la ruta.
 */
export interface CargaOtEstado {
  /** Copy humana del fallo de la carga; null mientras no haya fallo. */
  readonly error: Signal<string | null>;
  reintentar(): void;
}

/**
 * Observa el parámetro `:id` de la ruta y carga la OT correspondiente.
 * Estandariza el patrón `paramMap → getOtById` de las páginas de cliente/técnico.
 *
 * El 404 (orden ajena al rol) y los 4xx/5xx entran por el mismo aviso: la
 * respuesta del backend ya viene traducida por `mensajeErrorAccion`, así que
 * la página solo decide dónde y cómo mostrar la copy.
 */
export function cargarOtDesdeRuta(
  route: ActivatedRoute,
  otApi: OtApi,
  onId: (id: string) => void,
  onOt: (ot: OtResponse | undefined) => void,
): CargaOtEstado {
  const error = signal<string | null>(null);
  let ultimoId = '';

  const cargar = (): void => {
    if (!ultimoId) return;
    error.set(null);
    otApi.getOtById(ultimoId).subscribe({
      next: onOt,
      error: (err: unknown) => {
        error.set(mensajeErrorAccion(err));
      },
    });
  };

  route.paramMap.subscribe((params) => {
    const id = params.get('id');
    if (id) {
      onId(id);
      ultimoId = id;
      cargar();
    }
  });

  return { error: error.asReadonly(), reintentar: cargar };
}
