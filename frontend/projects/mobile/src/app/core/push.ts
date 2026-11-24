import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '@core/service/api.config';

/**
 * Notificaciones push (FCM) en Android.
 *
 * <p><b>Estado:</b> código y contrato listos, desactivados. Sin Firebase la
 * app NO puede registrarse para push: `PushNotifications.register()` sin
 * `google-services.json` termina en un error nativo. Para activarlas:
 *
 * <ol>
 * <li>Crear el proyecto Firebase con el appId `com.coldday.app` y copiar
 * `google-services.json` a `frontend/android/app/` (el build de Capacitor aplica
 * el plugin de Google Services solo si el archivo existe).</li>
 * <li>Poner `habilitado: true` en {@link PUSH}.</li>
 * <li>`npx cap sync android` y reconstruir el APK.</li>
 * <li>Backend: ya existe `FcmNotificacionPushAdapter`; se activa con
 * `FCM_ENABLED=true` y `FCM_CREDENTIALS_JSON` o `FCM_CREDENTIALS_PATH` (cuenta de
 * servicio de Firebase, ver `backend/.env.example`).</li>
 * </ol>
 *
 * Mientras `habilitado` sea `false` no se pide permiso ni se registra nada: la
 * app sigue avisando solo con toasts en primer plano.
 */
export interface PushConfig {
  readonly habilitado: boolean;
}

export const PUSH: PushConfig = { habilitado: true };

/** Canal Android de notificaciones: un canal no cambia de sonido una vez creado, por eso hay uno por rol y evento. */
export interface CanalPush {
  /** Mismo id que `CanalPush.java` en el backend: si difieren, el aviso pierde el sonido. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Archivo en `android/app/src/main/res/raw` (con extensión). */
  readonly sound: string;
}

/**
 * Canales de alta prioridad. Sonidos: Interface Sounds de Kenney (CC0),
 * `switch_006` para avisos de seguimiento y `switch_007` para lo nuevo.
 */
export const CANALES_PUSH: readonly CanalPush[] = [
  {
    id: 'ot_nueva_tec',
    name: 'Ofertas nuevas',
    description: 'Ofertas de servicio cerca de ti',
    sound: 'switch_007.ogg',
  },
  {
    id: 'ot_update_tec',
    name: 'Cambios en tu orden',
    description: 'Novedades de la orden de trabajo en curso',
    sound: 'switch_006.ogg',
  },
  {
    id: 'ot_nueva_cli',
    name: 'Presupuesto y técnico',
    description: 'Cuando llega un presupuesto o un técnico acepta tu orden',
    sound: 'switch_006.ogg',
  },
  {
    id: 'ot_update_cli',
    name: 'Cambios en tu solicitud',
    description: 'Otras novedades de tu solicitud de servicio',
    sound: 'switch_007.ogg',
  },
];

const RUTA_PERMITIDA = /^\/(cliente|tecnico|proveedor)\/[A-Za-z0-9/_:-]{1,120}$/;

/**
 * Ruta interna a abrir al tocar una notificación (`data.ruta`), o `null`. Solo
 * se aceptan rutas propias de un modo: un payload no puede mandar la app a otro lado.
 */
export function rutaDeNotificacion(data: Record<string, unknown> | undefined): string | null {
  const ruta = data?.['ruta'];
  return typeof ruta === 'string' && RUTA_PERMITIDA.test(ruta) && !ruta.includes('..') ? ruta : null;
}

@Injectable({ providedIn: 'root' })
export class PushNotificacionesService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly router = inject(Router);

  private token: string | null = null;
  private escuchando = false;

  /** `true` si hay un token registrado en este arranque. */
  tieneToken(): boolean {
    return this.token !== null;
  }

  /** Pide permiso, registra el dispositivo y deja lista la navegación al tocar. Nunca lanza. */
  async activar(config: PushConfig = PUSH): Promise<void> {
    if (!config.habilitado || !Capacitor.isNativePlatform()) {
      return;
    }
    try {
      const permiso = await PushNotifications.requestPermissions();
      if (permiso.receive !== 'granted') {
        return;
      }
      this.escuchar();
      for (const canal of CANALES_PUSH) {
        await PushNotifications.createChannel({
          id: canal.id,
          name: canal.name,
          description: canal.description,
          sound: canal.sound,
          importance: 5,
          visibility: 1,
        });
      }
      await PushNotifications.register();
    } catch {
      // Sin Firebase o sin permiso: la app sigue con avisos en primer plano.
    }
  }

  /** Da de baja el token del dispositivo (cerrar sesión). Nunca lanza. */
  async desactivar(): Promise<void> {
    const token = this.token;
    this.token = null;
    if (token === null) {
      return;
    }
    try {
      await firstValueFrom(
        this.http.request<void>('DELETE', this.apiConfig.url('/usuarios/me/dispositivos'), {
          body: { token, plataforma: 'ANDROID' },
        }),
      );
    } catch {
      // El backend reasigna el token al próximo inicio de sesión: no bloquea salir.
    }
  }

  private escuchar(): void {
    if (this.escuchando) {
      return;
    }
    this.escuchando = true;
    void PushNotifications.addListener('registration', ({ value }) => {
      this.token = value;
      this.http
        .post<void>(this.apiConfig.url('/usuarios/me/dispositivos'), { token: value, plataforma: 'ANDROID' })
        .subscribe({ error: () => undefined });
    });
    void PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const ruta = rutaDeNotificacion(notification.data as Record<string, unknown> | undefined);
      if (ruta) {
        void this.router.navigateByUrl(ruta);
      }
    });
  }
}
