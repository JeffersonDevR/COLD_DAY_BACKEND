import { Observable, throwError } from 'rxjs';

/**
 * Error uniforme para operaciones que el backend todavía no expone.
 * Mantiene el mensaje `Pendiente en el backend: ... Pendiente(backend).`
 */
export function pendienteBackend(detalle: string): Observable<never> {
  return throwError(() => new Error(`Pendiente en el backend: ${detalle}. Pendiente(backend).`));
}
