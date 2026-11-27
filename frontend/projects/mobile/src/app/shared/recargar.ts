import { Component, DestroyRef, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonRefresherContent } from '@ionic/angular';
import { Observable, finalize, take } from 'rxjs';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { MobileToastService } from '../core/toast.service';

/**
 * Deslizar para recargar: `<ion-refresher slot="fixed" [cdRecargar]="recargar">`.
 * La pantalla entrega un observable que solo cambia datos si llega la respuesta;
 * aquí se cierra siempre el indicador y se avisa el fallo.
 */
@Directive({
  selector: '[cdRecargar]',
  host: { '(ionRefresh)': 'alDeslizar($event)' },
})
export class RecargarDirective {
  readonly cdRecargar = input.required<() => Observable<unknown>>();

  private readonly toast = inject(MobileToastService);
  private readonly destroyRef = inject(DestroyRef);

  alDeslizar(evento: Event): void {
    const indicador = evento.target as unknown as { complete(): void };
    this.cdRecargar()()
      .pipe(
        take(1),
        finalize(() => indicador.complete()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (err: unknown) => avisarErrorAccion(this.toast, 'No pudimos actualizar', err),
      });
  }
}

/** Los textos del indicador, iguales en todas las pantallas. */
@Component({
  selector: 'cd-recarga-contenido',
  imports: [IonRefresherContent],
  template: `
    <ion-refresher-content
      pullingText="Desliza para actualizar"
      refreshingSpinner="dots"
      refreshingText="Actualizando..."
    ></ion-refresher-content>
  `,
})
export class ContenidoRecargaComponent {}
