import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';
import { Rol } from '../models/common.models';

@Component({
  selector: 'app-panel-redirect',
  template: `
    <div class="min-h-[40vh] flex items-center justify-center">
      <div class="text-center space-y-2">
        <div class="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs text-slate-500">Cargando tu panel de control...</p>
      </div>
    </div>
  `
})
export class PanelRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.router.navigate([this.routeForUser(user.rol, this.auth.userRoles())]);
  }

  /**
   * Ruta del panel por defecto. Un usuario dual (Cliente + Técnico) entra por su
   * rol PRIMARIO; si ese rol no tiene panel (p. ej. un valor desconocido), se
   * usa el primer rol del conjunto que sí lo tenga. Sin coincidencias, raíz.
   */
  private routeForUser(primary: Rol, roles: ReadonlySet<Rol>): string {
    const primaryRoute = this.routeFor(primary);
    if (primaryRoute) return primaryRoute;
    for (const rol of roles) {
      const route = this.routeFor(rol);
      if (route) return route;
    }
    return '/';
  }

  private routeFor(rol: Rol): string | null {
    switch (rol) {
      case 'CLIENTE':
        return '/cliente/panel';
      case 'TECNICO':
        return '/tecnico/panel';
      case 'ADMINISTRADOR':
      case 'CONTABLE':
        return '/admin/dashboard';
      case 'PROVEEDOR':
        return '/proveedor/panel';
      default:
        return null;
    }
  }
}
