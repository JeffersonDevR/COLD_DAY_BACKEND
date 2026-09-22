import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/shared/infrastructure/auth/auth.service';
import { ToastHost } from './core/shared/presentation/components/toast-host';
import { AppTopbar } from './layout/components/app-topbar';
import { AppSidebar } from './layout/components/app-sidebar';
import { AppFooter } from './layout/components/app-footer';
import { LayoutService } from './layout/service/layout.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost, AppTopbar, AppSidebar, AppFooter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly layout = inject(LayoutService);

  readonly estaAutenticado = computed(() => this.auth.isAuthenticated());

  /** Desplaza el contenido según el layout: estático (sidebar empuja) u overlay. */
  readonly contenidoClass = computed(() => {
    if (this.layout.menuMode() === 'overlay') {
      return 'lg:pl-0';
    }
    return this.layout.sidebarCollapsed() ? 'lg:pl-20' : 'lg:pl-72';
  });
}
