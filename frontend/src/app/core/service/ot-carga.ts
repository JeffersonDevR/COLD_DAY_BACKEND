import { Signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiConfig } from './api.config';
import { MockDbService } from './mock-db.service';
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
 * Observa el parámetro `:id` de la ruta y carga la OT correspondiente.
 * Estandariza el patrón `paramMap → getOtById` de las páginas de cliente/técnico.
 */
export function cargarOtDesdeRuta(
  route: ActivatedRoute,
  otApi: OtApi,
  onId: (id: string) => void,
  onOt: (ot: OtResponse | undefined) => void,
): void {
  route.paramMap.subscribe((params) => {
    const id = params.get('id');
    if (id) {
      onId(id);
      otApi.getOtById(id).subscribe({ next: onOt });
    }
  });
}
