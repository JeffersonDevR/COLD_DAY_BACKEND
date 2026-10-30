import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { LayoutService } from '../../core/service/layout.service';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { resolverPanel } from '../../core/navihationError/panel-resolver';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, Button, Menu],
  templateUrl: './app-topbar.html',
})
export class AppTopbar {
  readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.auth.currentUser());

  /**
   * Rótulo del usuario: el nombre de la sesión, si no el correo, y si tampoco lo
   * hay, un rótulo neutro. El JWT real no trae `nombre`, así que nunca se deja la
   * etiqueta en blanco ni se inventa un nombre de persona.
   */
  readonly nombreVisible = computed(() => {
    const usuario = this.usuario();
    return usuario?.nombre?.trim() || usuario?.correo?.trim() || 'Usuario';
  });

  /** Iniciales derivadas del rótulo visible: lo que se muestra es lo que se abrevia. */
  readonly iniciales = computed(() =>
    this.nombreVisible()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join(''),
  );

  readonly userMenuItems = computed<MenuItem[]>(() => [
    // El correo identifica la cuenta, así que va primero; con un JWT real no hay
    // claims, y esta fila tampoco puede quedar en blanco.
    { label: this.usuario()?.correo || this.usuario()?.nombre || 'Usuario', disabled: true },
    { separator: true },
    { label: 'Ir a Mi Panel', icon: 'pi pi-home', command: () => this.router.navigate([this.rutaMiPanel()]) },
    { label: 'Cerrar Sesión', icon: 'pi pi-sign-out', command: () => this.cerrarSesion() },
  ]);

  cerrarSesion(): void {
    this.auth.logout();
    this.toast.success('Sesión Finalizada', 'Has cerrado sesión en COLD DAY S.A.S.');
    this.router.navigate(['/login']);
  }

  /**
   * Destino de "Mi Panel": el mismo resolutor que `/panel`. Un usuario
   * dual-role vuelve al último panel que usó, no al de su rol primario.
   */
  private rutaMiPanel(): string {
    const usuario = this.usuario();
    return usuario ? resolverPanel(usuario.rol, this.auth.userRoles()) : '/';
  }
}
