import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Observable, defer, from } from 'rxjs';
import { Point } from '@core/models/common.models';
import { GeolocationService } from '@core/service/geolocation.service';

/**
 * Geolocalización de la app móvil.
 *
 * En nativo usa el plugin de Capacitor: pide el permiso al sistema y devuelve la
 * posición con el mismo contrato (`Observable<Point>`) que el servicio web, así
 * las pantallas no cambian. En `ng serve mobile` (web) delega en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class MobileGeolocationService {
  private readonly web = inject(GeolocationService);

  obtenerPosicion(): Observable<Point> {
    if (!Capacitor.isNativePlatform()) {
      return this.web.obtenerPosicion();
    }

    return defer(() => from(this.obtenerNativa()));
  }

  private async obtenerNativa(): Promise<Point> {
    const actuales = await Geolocation.checkPermissions();
    if (actuales.location !== 'granted') {
      const pedidos = await Geolocation.requestPermissions();
      if (pedidos.location !== 'granted') {
        throw new Error(
          'Permiso de ubicación denegado. Activalo en los ajustes del teléfono para usar tu posición.',
        );
      }
    }

    const posicion = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    });

    return {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
    };
  }
}
