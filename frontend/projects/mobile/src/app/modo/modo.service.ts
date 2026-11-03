import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/service/auth.service';
import { ModoApp, ORDEN_MODOS, esModoApp, rutaHome } from './modo';

/** Preferencia del dispositivo, no de la sesión: el modo elegido sobrevive al refresh. */
export const CLAVE_MODO = 'coldday.modo';

function leerModoPersistido(): ModoApp | null {
  try {
    const guardado = window.localStorage.getItem(CLAVE_MODO);
    return esModoApp(guardado) ? guardado : null;
  } catch {
    // Storage bloqueado (modo privado): se usa el default por prioridad.
    return null;
  }
}

function persistirModo(modo: ModoApp): void {
  try {
    window.localStorage.setItem(CLAVE_MODO, modo);
  } catch {
    // Sin storage la elección vive solo en memoria: no se rompe la navegación.
  }
}

/**
 * Resuelve en qué modo opera la app (B15).
 *
 * - `modosDisponibles` sale de `AuthService.userRoles()`, en orden de prioridad.
 * - `modoActual` respeta el último modo usado si sigue disponible; si no, cae al
 *   primero disponible (CLIENTE → TECNICO → PROVEEDOR).
 * - Un usuario solo-admin obtiene `[]` y la app lo manda a la pantalla "usá la web".
 */
@Injectable({
  providedIn: 'root',
})
export class ModoService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly _persistido = signal<ModoApp | null>(leerModoPersistido());

  readonly modosDisponibles = computed<ModoApp[]>(() => {
    const roles = this.auth.userRoles();
    return ORDEN_MODOS.filter((modo) => roles.has(modo));
  });

  readonly modoActual = computed<ModoApp | null>(() => {
    const disponibles = this.modosDisponibles();
    const persistido = this._persistido();
    if (persistido && disponibles.includes(persistido)) return persistido;
    return disponibles[0] ?? null;
  });

  /** Ruta home del modo actual; `null` cuando la cuenta no tiene modo móvil. */
  readonly homeActual = computed<string | null>(() => {
    const modo = this.modoActual();
    return modo ? rutaHome(modo) : null;
  });

  disponible(modo: ModoApp): boolean {
    return this.modosDisponibles().includes(modo);
  }

  /** Cambia de modo, lo persiste y navega al home del modo elegido. */
  cambiarModo(modo: ModoApp): void {
    if (!this.disponible(modo)) return;
    this._persistido.set(modo);
    persistirModo(modo);
    void this.router.navigateByUrl(rutaHome(modo));
  }
}
