import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Popover } from 'primeng/popover';
import { LayoutService } from '../../core/service/layout.service';
import { AuthService } from '../../core/service/auth.service';
import { ThemeService } from '../../core/service/theme.service';
import { ToastService } from '../../core/alertas/toast.service';
import { AppConfigurator } from '../app-configurator/app-configurator';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, Button, Menu, Popover, AppConfigurator],
  templateUrl: './app-topbar.html',
})
export class AppTopbar {
  readonly layout = inject(LayoutService);
  readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.auth.currentUser());

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '?';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  });

  readonly userMenuItems = computed<MenuItem[]>(() => [
    { label: this.usuario()?.correo, disabled: true },
    { separator: true },
    { label: 'Ir a Mi Panel', icon: 'pi pi-home', command: () => this.router.navigate(['/panel']) },
    { label: 'Cerrar Sesión', icon: 'pi pi-sign-out', command: () => this.cerrarSesion() },
  ]);

  cerrarSesion(): void {
    this.auth.logout();
    this.toast.success('Sesión Finalizada', 'Has cerrado sesión en COLD DAY S.A.S.');
    this.router.navigate(['/login']);
  }
}
