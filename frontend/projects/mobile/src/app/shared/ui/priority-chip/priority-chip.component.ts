import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Prioridad } from '@core/models/common.models';

/**
 * Tono del chip según la prioridad (DESIGN §2.2): ALTA usa el rojo de peligro,
 * MEDIA el cian de acción y BAJA el verde de éxito. Los tres son tinta sobre
 * tinte, nunca relleno sólido.
 */
const TONO_PRIORIDAD: Record<Prioridad, string> = {
  ALTA: 'cerrada',
  MEDIA: 'curso',
  BAJA: 'ok',
};

/** Etiqueta visible: el color nunca es la única señal (UI-C4). */
const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

/**
 * Chip de prioridad reutilizable para toda tarjeta de orden.
 * Reutiliza `.cd-chip` y sus tonos existentes: no añade CSS nuevo.
 */
@Component({
  selector: 'app-priority-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="cd-chip cd-chip--{{ tono() }}" data-testid="prioridad-chip">{{
    conPalabra() ? 'Prioridad ' + etiqueta().toLowerCase() : etiqueta()
  }}</span>`,
})
export class PriorityChipComponent {
  /** Las órdenes sin dato del backend se muestran como Media. */
  readonly prioridad = input<Prioridad>('MEDIA');
  /** «Prioridad media»: la palabra sola junto a un estado no se entendía. */
  readonly conPalabra = input(false);

  protected readonly tono = computed(() => TONO_PRIORIDAD[this.prioridad()]);
  protected readonly etiqueta = computed(() => ETIQUETA_PRIORIDAD[this.prioridad()]);
}
