import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Cámara de la app móvil.
 *
 * Estado actual (decisión de producto): la foto se captura y se muestra en el
 * dispositivo, pero **no se envía** a ningún lado. El backend es metadata-only y
 * todavía no existe storage de evidencias; simular una subida sería mentir.
 */
@Injectable({ providedIn: 'root' })
export class MobileCameraService {
  esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  async tomarFoto(): Promise<string | null> {
    if (!this.esNativo()) {
      return null;
    }

    const actuales = await Camera.checkPermissions();
    if (actuales.camera !== 'granted') {
      const pedidos = await Camera.requestPermissions({ permissions: ['camera'] });
      if (pedidos.camera !== 'granted') {
        throw new Error(
          'Permiso de cámara denegado. Activalo en los ajustes del teléfono para sacar la foto.',
        );
      }
    }

    const foto = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 70,
      width: 1600,
    });

    return foto.dataUrl ?? null;
  }
}
