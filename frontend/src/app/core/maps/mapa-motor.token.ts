import { InjectionToken, inject } from '@angular/core';
import { MapaConfigService } from '../service/mapa-config.service';
import { GoogleMotor } from './google-motor';
import { MapaMotor } from './mapa-motor';

/**
 * Motor de mapa de la app. Lo elige el backend con `proveedor` en
 * `GET /api/config/maps`. Un valor ausente o desconocido cae a Google: un
 * proveedor mal escrito no debe dejar la app sin mapa.
 *
 * Para sumar un proveedor: crear su `MapaMotor` y añadir su caso aquí.
 */
export const MAPA_MOTOR = new InjectionToken<MapaMotor>('MAPA_MOTOR', {
  providedIn: 'root',
  factory: () => {
    const proveedor = inject(MapaConfigService).proveedor();
    switch (proveedor) {
      case 'google':
      default:
        return inject(GoogleMotor);
    }
  },
});
