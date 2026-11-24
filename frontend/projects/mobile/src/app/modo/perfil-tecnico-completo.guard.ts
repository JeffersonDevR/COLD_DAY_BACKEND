import { Injectable, inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { TecnicoResponse } from '@core/models/common.models';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { TokenStorageService } from '@core/service/token-storage.service';
import { catchError, map, of } from 'rxjs';

/** Rutas del modo técnico que se pueden abrir sin el perfil completo. */
const RUTAS_LIBRES = ['/tecnico/perfil', '/tecnico/cuenta'];

/** El registro ya no pide cédula ni especialidades: sin ellas no hay ofertas posibles. */
export function perfilTecnicoCompleto(tecnico: TecnicoResponse): boolean {
  const cedula = (tecnico.numeroIdentificacion ?? tecnico.cedula ?? '').trim();
  const categorias = tecnico.categoriasServicio ?? tecnico.categorias ?? [];
  return cedula.length > 0 && categorias.length > 0;
}

/** Recuerda, por sesión, que el perfil ya está completo para no consultarlo en cada tab. */
@Injectable({ providedIn: 'root' })
export class PerfilTecnicoEstado {
  private tokenCompleto: string | null = null;

  esCompletoPara(token: string | null): boolean {
    return token !== null && this.tokenCompleto === token;
  }

  marcarCompleto(token: string | null): void {
    this.tokenCompleto = token;
  }
}

/**
 * Gate del modo técnico: sin cédula y especialidades lo manda a completar su
 * perfil. Si el perfil no se puede leer (red), no lo encierra: deja pasar.
 */
export const perfilTecnicoCompletoGuard: CanActivateChildFn = (_ruta, estado) => {
  if (RUTAS_LIBRES.some((ruta) => estado.url.startsWith(ruta))) return true;

  const memoria = inject(PerfilTecnicoEstado);
  const token = inject(TokenStorageService).currentToken() ?? null;
  if (memoria.esCompletoPara(token)) return true;

  const router = inject(Router);
  return inject(TecnicosApi)
    .getMiPerfil()
    .pipe(
      map((tecnico) => {
        if (perfilTecnicoCompleto(tecnico)) {
          memoria.marcarCompleto(token);
          return true;
        }
        return router.createUrlTree(['/tecnico/perfil'], { queryParams: { completar: 1 } });
      }),
      catchError(() => of(true)),
    );
};
