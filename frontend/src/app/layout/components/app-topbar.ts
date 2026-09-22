import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Popover } from 'primeng/popover';
import { LayoutService } from '../service/layout.service';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { ThemeService } from '../../core/shared/presentation/theme.service';
import { ToastService } from '../../core/shared/presentation/toast.service';
import { AppConfigurator } from './app-configurator';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, Button, Menu, Popover, AppConfigurator],
  template: `
    <header
      class="fixed top-0 inset-x-0 z-50 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800"
    >
      <div class="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
        <!-- Toggle móvil -->
        <p-button
          icon="pi pi-bars"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          styleClass="lg:hidden!"
          ariaLabel="Abrir menú"
          (onClick)="layout.toggleMobileMenu()"
        />

        <!-- Toggle escritorio -->
        <p-button
          icon="pi pi-bars"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          styleClass="hidden! lg:inline-flex!"
          ariaLabel="Colapsar menú"
          (onClick)="layout.toggleMenu()"
        />

        <!-- Marca -->
        <a routerLink="/panel" class="flex items-center gap-2.5 shrink-0">
          <span
            class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20"
          >
            <i class="pi pi-sparkles text-lg"></i>
          </span>
          <span class="hidden sm:block leading-tight">
            <span class="block text-sm font-black tracking-tight text-slate-950 dark:text-white">COLD DAY</span>
            <span class="block text-[10px] font-semibold text-slate-400">Plataforma Multiservicios</span>
          </span>
        </a>

        <div class="flex-1"></div>

        <!-- Modo oscuro -->
        <p-button
          [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          [ariaLabel]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'"
          (onClick)="theme.toggleTheme()"
        />

        <!-- Personalizador de tema (paleta) -->
        <p-popover #themePanel appendTo="body">
          <app-configurator />
        </p-popover>
        <p-button
          icon="pi pi-palette"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          ariaLabel="Personalizar tema"
          (onClick)="themePanel.toggle($event)"
        />

        <!-- Usuario -->
        <button
          type="button"
          class="flex items-center gap-2 rounded-xl pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          (click)="userMenu.toggle($event)"
        >
          <p-avatar [label]="iniciales()" shape="circle" styleClass="bg-sky-600! text-white!" />
          <span class="hidden md:block text-left leading-tight">
            <span class="block text-xs font-bold text-slate-900 dark:text-slate-100">{{ usuario()?.nombre }}</span>
            <span class="block text-[10px] font-extrabold uppercase text-sky-600 dark:text-sky-400">{{ usuario()?.rol }}</span>
          </span>
          <i class="pi pi-angle-down text-xs text-slate-400"></i>
        </button>
        <p-menu #userMenu [model]="userMenuItems()" [popup]="true" appendTo="body" />
      </div>
    </header>
  `,
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
