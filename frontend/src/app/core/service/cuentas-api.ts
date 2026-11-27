import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiHttpError } from '../alertas/api-http.error';
import { Rol } from '../models/common.models';
import { rolesGestionables } from '../permisos';
import { ApiConfig } from './api.config';
import { MockDbService } from './mock-db.service';

/** Cuenta del panel que gestiona el administrador. Espeja `CuentaApiResponse.java`. */
export interface CuentaInterna {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  activa: boolean;
}

export type NuevaCuenta = Pick<CuentaInterna, 'nombre' | 'correo' | 'rol'>;

@Injectable({ providedIn: 'root' })
export class CuentasApi {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);
  private readonly mockDb = inject(MockDbService);

  listar(): Observable<CuentaInterna[]> {
    if (this.apiConfig.useMocks()) {
      const gestionables = rolesGestionables();
      const cuentas = this.mockDb.usuarios()
        .filter((u) => gestionables.includes(u.rol))
        .map((u) => ({ id: Number(u.id), nombre: u.nombre, correo: u.correo, rol: u.rol, activa: u.activo !== false }));
      return of(cuentas).pipe(delay(200));
    }
    return this.http.get<CuentaInterna[]>(this.apiConfig.url('/admin/cuentas'));
  }

  crear(cuenta: NuevaCuenta): Observable<CuentaInterna> {
    if (this.apiConfig.useMocks()) {
      const usuarios = this.mockDb.usuarios();
      if (usuarios.some((u) => u.correo.toLowerCase() === cuenta.correo.toLowerCase())) {
        return throwError(() => new ApiHttpError('Ya existe una cuenta con ese correo.', 409));
      }
      const id = Math.max(0, ...usuarios.map((u) => Number(u.id))) + 1;
      this.mockDb.usuarios.update((todos) => [
        ...todos,
        { id, ...cuenta, habeasDataAceptado: false, activo: true, fechaRegistro: new Date().toISOString() },
      ]);
      return of({ id, ...cuenta, activa: true }).pipe(delay(200));
    }
    return this.http.post<CuentaInterna>(this.apiConfig.url('/admin/cuentas'), cuenta);
  }

  cambiarEstado(id: number, activa: boolean): Observable<void> {
    if (this.apiConfig.useMocks()) {
      this.mockDb.usuarios.update((todos) => todos.map((u) => (Number(u.id) === id ? { ...u, activo: activa } : u)));
      return of(undefined).pipe(delay(200));
    }
    return this.http.patch<void>(this.apiConfig.url(`/admin/cuentas/${id}/estado`), { activa });
  }
}
