import { TecnicoResponse } from '../models/common.models';
import { TecnicosApi } from './tecnicos-api';

/**
 * Resuelve el perfil del técnico autenticado desde el JWT: el backend lo
 * expone en GET /api/tecnicos/me y lo resuelve a partir del principal, así que
 * el front no envía ningún id. Centraliza el patrón repetido en panel, ofertas,
 * liquidaciones y documentos.
 */
export function cargarTecnicoAutenticado(
  tecnicosApi: TecnicosApi,
  onTecnico: (tecnico: TecnicoResponse | undefined) => void,
  onError?: () => void,
): void {
  tecnicosApi.getMiPerfil().subscribe({
    next: onTecnico,
    error: () => {
      onTecnico(undefined);
      onError?.();
    },
  });
}
