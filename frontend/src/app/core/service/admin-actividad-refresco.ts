import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, finalize } from 'rxjs';
import { AdminActividad, SseService, TipoActividadAdmin } from './sse.service';

/**
 * Ventana de calma de la recarga. Una ráfaga de eventos (por ejemplo una
 * liquidación aprobada que dispara varios hechos) produce UNA sola recarga.
 */
export const ESPERA_RECARGA_ADMIN_MS = 700;

export interface RefrescoActividadAdmin {
  /** Canal admin; `null` cuando no está disponible (mock, SSR, specs sin HTTP). */
  readonly sse: SseService | null;
  /** Ciclo de vida de la pantalla: corta el stream y el timer pendiente. */
  readonly destruir: DestroyRef;
  /** Tipos que ameritan recargar; `'todos'` recarga con cualquier actividad. */
  readonly tipos: readonly TipoActividadAdmin[] | 'todos';
  /**
   * Recarga de la pantalla. El observable es lo que permite saber cuándo
   * terminó: sin eso no se puede evitar una segunda carga en paralelo.
   */
  readonly recargar: () => Observable<unknown>;
  readonly esperaMs?: number;
}

/**
 * Refresca una pantalla admin cuando llega actividad relevante por SSE.
 *
 * Reglas que aplica, en un solo lugar para las cuatro pantallas:
 * - Ignora los `tipo` que no le importan a la pantalla.
 * - Agrupa una ráfaga en una sola recarga (debounce).
 * - Nunca lanza una recarga mientras otra está en vuelo; deja UNA pendiente.
 * - Degrada en silencio: si el stream no existe o se rinde, la pantalla sigue
 *   con su carga + reintento manual de siempre.
 */
export function refrescarConActividadAdmin(refresco: RefrescoActividadAdmin): void {
  const sse = refresco.sse;
  if (sse === null) return;

  const esperaMs = refresco.esperaMs ?? ESPERA_RECARGA_ADMIN_MS;
  const tipos = refresco.tipos;

  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let enVuelo = false;
  let pendiente = false;
  let destruido = false;

  const programar = (): void => {
    // Una recarga en vuelo puede terminar después del destroy: ahí ya no hay
    // pantalla que refrescar.
    if (destruido) return;
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      ejecutar();
    }, esperaMs);
  };

  const ejecutar = (): void => {
    if (enVuelo) {
      // Una sola recarga pendiente: las siguientes ráfagas se funden en esta.
      pendiente = true;
      return;
    }
    enVuelo = true;
    pendiente = false;
    refresco
      .recargar()
      .pipe(
        finalize(() => {
          enVuelo = false;
          if (pendiente) {
            pendiente = false;
            programar();
          }
        }),
      )
      // La recarga ya reporta su propio error en pantalla: acá solo se libera
      // el turno para que el stream siga escuchando.
      .subscribe({ error: () => undefined });
  };

  refresco.destruir.onDestroy(() => {
    destruido = true;
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  });

  sse
    .abrirAdminStream()
    .pipe(
      filter((actividad: AdminActividad) => tipos === 'todos' || tipos.includes(actividad.tipo)),
      takeUntilDestroyed(refresco.destruir),
    )
    .subscribe({
      next: () => programar(),
      // Si el stream se rinde, la pantalla mantiene su carga + reintento manual.
      error: () => undefined,
    });
}
