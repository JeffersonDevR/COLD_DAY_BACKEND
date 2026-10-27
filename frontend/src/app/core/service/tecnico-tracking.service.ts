import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Subscription, switchMap, throttleTime } from 'rxjs';
import { GeolocationService } from './geolocation.service';
import { Point } from '../models/common.models';
import { TecnicosApi } from './tecnicos-api';
import { visibleTabChanges } from './visible-tab-polling';

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
  /** Copy por cualquier falla del watch (permiso denegado, señal, tiempo de espera excedido). */
  private static readonly MENSAJE_FALLA_GPS =
    'No se pudo reportar tu ubicación. Revisá el permiso de geolocalización de tu navegador y reintentá.';
  private readonly geo = inject(GeolocationService);
  private readonly tecnicosApi = inject(TecnicosApi);

  private suscripcion: Subscription | null = null;

  readonly activo = signal<boolean>(false);
  readonly ultimaPosicion = signal<Point | null>(null);
  /**
   * Motivo legible (en español) por el que el tracking NO está reportando.
   * `null` significa que no hay un problema conocido: o está reportando, o
   * simplemente no se ha iniciado.
   */
  readonly motivo = signal<string | null>(null);

  /**
   * Empieza a publicar la posición. El watch SOLO está suscripto con la pestaña
   * visible: en segundo plano no hay usuario mirando el mapa y mantener el GPS
   * encendido gasta batería y datos sin que nadie vea el resultado. Al volver a
   * la pestaña arranca un watch nuevo, así que la primera posición reportada es
   * fresca y no la que quedó congelada al ocultarla.
   */
  iniciar(intervaloMs = 15000): void {
    if (this.suscripcion) {
      return;
    }
    if (!this.geo.disponible) {
      // Mismo mensaje que usa GeolocationService cuando el navegador no la soporta.
      this.motivo.set('La geolocalización no está disponible en este navegador.');
      return;
    }
    // Nuevo intento limpio: descarta un motivo de fallo anterior.
    this.motivo.set(null);
    this.activo.set(true);
    this.suscripcion = visibleTabChanges()
      .pipe(
        switchMap((visible) =>
          visible
            ? this.geo
                .vigilarPosicion()
                .pipe(throttleTime(intervaloMs, undefined, { leading: true, trailing: true }))
            : EMPTY,
        ),
      )
      .subscribe({
        next: (punto) => this.emitir(punto),
        error: () => {
          // Un error del watch (p. ej. permiso denegado) corta la suscripción.
          // `detener()` limpia el motivo, así que se restaura después para que
          // la UI pueda explicar por qué ya no se reporta. Sin el mensaje
          // crudo del navegador (en inglés): copy neutra en español.
          this.detener();
          this.motivo.set(TecnicoTrackingService.MENSAJE_FALLA_GPS);
        },
      });
  }

  /**
   * Detiene el tracking de forma intencional. Limpia `motivo` porque una parada
   * pedida por la aplicación no es un fallo; si el objetivo fuera conservarlo,
   * el llamador debería restaurarlo tras `detener()` (como hace el handler de error).
   */
  detener(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.activo.set(false);
    this.motivo.set(null);
  }

  private emitir(punto: Point): void {
    this.ultimaPosicion.set(punto);
    // Posición recibida y válida: ya no hay motivo que mostrar.
    this.motivo.set(null);
    this.tecnicosApi
      .actualizarUbicacion({ latitud: punto.latitud, longitud: punto.longitud })
      .subscribe({
        error: () => {
          // Aquí solo puede fallar la subida puntual (sin conexión o sin perfil);
          // el watch sigue vivo y se reintenta en el próximo tick. Un error del
          // propio watch es distinto: corta la suscripción y detiene el tracking.
        },
      });
  }
}
