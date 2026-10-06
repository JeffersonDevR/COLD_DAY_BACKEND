import { Injectable, signal } from '@angular/core';
import { EstadoValidacionProveedor } from '../../../core/models/common.models';

/**
 * Recordatorio del alta para el portal del proveedor.
 *
 * `POST /api/proveedores` devuelve el `ProveedorResponse` completo, incluido
 * `estadoValidacion`, pero el backend NO expone `GET /api/proveedores/me` (a
 * diferencia del técnico, que sí resuelve su perfil desde el JWT). Sin una
 * lectura del perfil, el único momento en que la app conoce el estado de
 * validación es justo después del alta.
 *
 * Por eso se guarda en `sessionStorage`: el registro redirige a
 * `/proveedor/documentos` tras el login, y un `sessionStorage` sobrevive a esa
 * navegación y a un F5 dentro de la misma pestaña, sin dejar el estado de
 * validación pegado en el disco entre sesiones. Cuando el backend exponga el
 * perfil del proveedor, esta pieza se sustituye por esa lectura y desaparece.
 */
const CLAVE = 'coldday.proveedor.registro';

interface RegistroProveedor {
  id: string;
  usuarioId?: number;
  razonSocial: string;
  nit: string;
  estadoValidacion: EstadoValidacionProveedor;
}

@Injectable({ providedIn: 'root' })
export class ProveedorRegistroService {
  private readonly _registro = signal<RegistroProveedor | undefined>(this.leer());
  readonly registro = this._registro.asReadonly();

  /** Estado de validación conocido de esta sesión; `undefined` si no hubo alta. */
  readonly estadoValidacion = signal<EstadoValidacionProveedor | undefined>(
    this.leer()?.estadoValidacion
  );

  guardar(registro: RegistroProveedor): void {
    this._registro.set(registro);
    this.estadoValidacion.set(registro.estadoValidacion);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(CLAVE, JSON.stringify(registro));
    }
  }

  limpiar(): void {
    this._registro.set(undefined);
    this.estadoValidacion.set(undefined);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CLAVE);
    }
  }

  private leer(): RegistroProveedor | undefined {
    if (typeof window === 'undefined' || !window.sessionStorage) return undefined;
    const raw = window.sessionStorage.getItem(CLAVE);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as RegistroProveedor;
    } catch {
      // Un valor corrupto no puede romper el arranque del portal: se ignora.
      return undefined;
    }
  }
}
