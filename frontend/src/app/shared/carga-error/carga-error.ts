import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Aviso de carga fallida con reintentar (patrón "Repuestos"). Un listado que no
 * pudo cargar nunca queda en blanco: dice qué pasó y ofrece reintentar.
 */
@Component({
  selector: 'app-carga-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carga-error.html',
})
export class CargaError {
  readonly mensaje = input<string>('No pudimos cargar los datos. Inténtalo de nuevo.');
  readonly reintentar = output<void>();
}
