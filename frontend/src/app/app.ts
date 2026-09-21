import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from './core/shared/infrastructure/auth/auth.service';
import { ToastHost } from './core/shared/presentation/components/toast-host';
import { ToastService } from './core/shared/presentation/toast.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly toast = inject(ToastService);
  readonly router = inject(Router);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly menuMovilAbierto = signal<boolean>(false);

  readonly usuario = computed(() => this.auth.currentUser());
  readonly estaAutenticado = computed(() => this.auth.isAuthenticated());

  toggleMenuMovil(): void {
    this.menuMovilAbierto.set(!this.menuMovilAbierto());
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.toast.success('Sesión Finalizada', 'Has cerrado sesión en COLD DAY S.A.S.');
    this.router.navigate(['/login']);
  }
}
