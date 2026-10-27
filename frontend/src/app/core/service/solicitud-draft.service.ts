import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { CategoriaServicio, Point } from '../models/common.models';

/**
 * Borrador del formulario de solicitud de servicio.
 *
 * El estado del formulario vive en signals del componente y muere al navegar
 * (por ejemplo, al alta del perfil de cliente). Se guarda en `sessionStorage`
 * —igual que el recordatorio del proveedor— para sobrevivir a esa navegación y
 * a un F5 dentro de la misma pestaña, sin dejar datos de la solicitud en disco.
 * La clave incluye el id del usuario: el borrador de una cuenta nunca se
 * restaura en otra.
 */
export interface SolicitudDraft {
  categoria: CategoriaServicio;
  descripcion: string;
  direccion: string;
  coordenadas: Point | null;
  evidenciaUrl: string;
  /** Instante ISO-8601 del último cambio; permite descartar borradores viejos. */
  actualizadoEn: string;
}

const PREFIJO = 'coldday.solicitud.borrador';

@Injectable({ providedIn: 'root' })
export class SolicitudDraftService {
  private readonly auth = inject(AuthService);

  guardar(draft: SolicitudDraft): void {
    const clave = this.clave();
    if (!clave || !this.storage) return;
    try {
      this.storage.setItem(clave, JSON.stringify(draft));
    } catch {
      // Cuota llena o storage bloqueado: el borrador es una comodidad, nunca
      // debe romper el formulario ni la creación de la OT.
    }
  }

  leer(): SolicitudDraft | null {
    const clave = this.clave();
    if (!clave || !this.storage) return null;
    const raw = this.storage.getItem(clave);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SolicitudDraft> | null;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        categoria: parsed.categoria ?? 'AIRE_ACONDICIONADO',
        descripcion: parsed.descripcion ?? '',
        direccion: parsed.direccion ?? '',
        coordenadas: parsed.coordenadas ?? null,
        evidenciaUrl: parsed.evidenciaUrl ?? '',
        actualizadoEn: parsed.actualizadoEn ?? '',
      };
    } catch {
      // Un valor corrupto no puede romper el arranque de la página.
      return null;
    }
  }

  limpiar(): void {
    const clave = this.clave();
    if (!clave || !this.storage) return;
    this.storage.removeItem(clave);
  }

  private get storage(): Storage | null {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  }

  /** Clave por usuario; sin sesión no se persiste nada. */
  private clave(): string | null {
    const id = this.auth.currentUser()?.id;
    return id == null ? null : `${PREFIJO}.${id}`;
  }
}
