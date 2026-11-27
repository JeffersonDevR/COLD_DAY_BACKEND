import { Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';

/** Documentos declarados de una persona o empresa, con su estado de carga. */
export type Expediente<T> =
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; documentos: readonly T[]; desactualizado?: boolean };

export interface Expedientes<T> {
  readonly porId: Signal<Readonly<Record<string, Expediente<T>>>>;
  cargar(id: string): void;
}

/**
 * Una carga por id, para las bandejas de validación. Un fallo se distingue de
 * "no declaró nada", y recargar no borra lo que ya se estaba mostrando.
 */
export function crearExpedientes<T>(pedir: (id: string) => Observable<readonly T[]>): Expedientes<T> {
  const porId = signal<Record<string, Expediente<T>>>({});
  const poner = (id: string, expediente: Expediente<T>) =>
    porId.update((todos) => ({ ...todos, [id]: expediente }));

  return {
    porId: porId.asReadonly(),
    cargar(id: string): void {
      if (porId()[id]?.estado !== 'listo') {
        poner(id, { estado: 'cargando' });
      }
      pedir(id).subscribe({
        next: (documentos) => poner(id, { estado: 'listo', documentos }),
        error: () => {
          const previo = porId()[id];
          poner(id, previo?.estado === 'listo' ? { ...previo, desactualizado: true } : { estado: 'error' });
        },
      });
    },
  };
}
