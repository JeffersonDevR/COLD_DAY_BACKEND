import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicoResponse } from '../../../core/shared/domain/models/common.models';
import { TecnicosApi } from './tecnicos-api';

/**
 * Resuelve el perfil del técnico autenticado a partir del `usuarioId` del JWT.
 * Centraliza el patrón repetido en panel, ofertas, liquidaciones y documentos.
 */
export function cargarTecnicoAutenticado(
  auth: AuthService,
  tecnicosApi: TecnicosApi,
  onTecnico: (tecnico: TecnicoResponse | undefined) => void,
  onError?: () => void,
): void {
  const usuarioId = Number(auth.currentUser()?.id ?? 0);
  tecnicosApi.getTecnicoPorUsuarioId(usuarioId).subscribe({
    next: onTecnico,
    error: () => {
      onTecnico(undefined);
      onError?.();
    },
  });
}
