import { Injectable, Provider, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AVISO_SESION, AvisoSesion } from '@core/alertas/aviso-sesion';

export type AvisoTipo = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

/** Color de Ionic por tipo de aviso. */
const COLOR_POR_TIPO: Record<AvisoTipo, string> = {
  SUCCESS: 'success',
  ERROR: 'danger',
  INFO: 'primary',
  WARNING: 'warning',
};

/** Duración por tipo: los errores y advertencias se leen, los avisos no. */
const DURACION_POR_TIPO: Record<AvisoTipo, number> = {
  SUCCESS: 3000,
  ERROR: 5000,
  INFO: 3500,
  WARNING: 4500,
};

/**
 * Fachada de avisos de la app móvil sobre `ion-toast`.
 *
 * Reemplaza al `ToastService` de PrimeNG del proyecto web. Ningún método
 * rechaza: un fallo al mostrar el toast no puede tumbar la pantalla que lo pidió.
 */
@Injectable({
  providedIn: 'root',
})
export class MobileToastService {
  private readonly controller = inject(ToastController);

  async mostrar(
    tipo: AvisoTipo,
    titulo: string,
    mensaje?: string,
    duracionMs = DURACION_POR_TIPO[tipo],
  ): Promise<void> {
    try {
      const toast = await this.controller.create({
        header: titulo,
        message: mensaje,
        duration: duracionMs,
        position: 'top',
        color: COLOR_POR_TIPO[tipo],
      });
      await toast.present();
    } catch {
      // Sin UI de avisos disponible: la acción sigue su curso.
    }
  }

  success(titulo: string, mensaje?: string): Promise<void> {
    return this.mostrar('SUCCESS', titulo, mensaje);
  }

  error(titulo: string, mensaje?: string): Promise<void> {
    return this.mostrar('ERROR', titulo, mensaje);
  }

  info(titulo: string, mensaje?: string): Promise<void> {
    return this.mostrar('INFO', titulo, mensaje);
  }

  warning(titulo: string, mensaje?: string): Promise<void> {
    return this.mostrar('WARNING', titulo, mensaje);
  }
}

/**
 * Adaptador móvil del puerto `AVISO_SESION`: el aviso de sesión de la capa
 * compartida se muestra con `ion-toast`, sin arrastrar PrimeNG al bundle.
 */
export function provideAvisoSesion(): Provider {
  return {
    provide: AVISO_SESION,
    useFactory: (): AvisoSesion => {
      const toast = inject(MobileToastService);
      return {
        advertir: (titulo: string, mensaje?: string) => {
          void toast.warning(titulo, mensaje);
        },
      };
    },
  };
}
