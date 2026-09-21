import { Injectable, inject, signal } from '@angular/core';
import { Subscription, throttleTime } from 'rxjs';
import { GeolocationService } from '../../../core/shared/infrastructure/geolocation/geolocation.service';
import { Point } from '../../../core/shared/domain/models/common.models';
import { TecnicosApi } from './tecnicos-api';

/**
 * Publica la ubicación del técnico autenticado mientras el servicio está activo.
 *
 * Usa `watchPosition` del navegador y empuja `PUT /api/tecnicos/me/ubicacion`
 * con un throttle, de modo que el cliente pueda seguir el desplazamiento.
 * El backend desactiva el tracking por su cuenta al llegar a estados terminales.
 */
@Injectable({
  providedIn: 'root',
})
export class TecnicoTrackingService {
  private readonly geo = inject(GeolocationService);
  private readonly tecnicosApi = inject(TecnicosApi);

  private suscripcion: Subscription | null = null;

  readonly activo = signal<boolean>(false);
  readonly ultimaPosicion = signal<Point | null>(null);

  iniciar(intervaloMs = 15000): void {
    if (this.suscripcion || !this.geo.disponible) {
      return;
    }
    this.activo.set(true);
    this.suscripcion = this.geo
      .vigilarPosicion()
      .pipe(throttleTime(intervaloMs, undefined, { leading: true, trailing: true }))
      .subscribe({
        next: (punto) => this.emitir(punto),
        error: () => this.detener(),
      });
  }

  detener(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.activo.set(false);
  }

  private emitir(punto: Point): void {
    this.ultimaPosicion.set(punto);
    this.tecnicosApi
      .actualizarUbicacion({ latitud: punto.latitud, longitud: punto.longitud })
      .subscribe({
        error: () => {
          // Sin conexión o sin perfil de técnico: se reintenta en el próximo tick.
        },
      });
  }
}
