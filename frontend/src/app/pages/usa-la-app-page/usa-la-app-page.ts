import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/service/auth.service';

/**
 * Destino de las cuentas de cliente, técnico y proveedor que entran a la web:
 * esas funciones viven en la app móvil y la web es solo para el equipo interno.
 */
@Component({
  selector: 'app-usa-la-app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usa-la-app-page.html',
})
export class UsaLaAppPage {
  private readonly auth = inject(AuthService);

  cerrarSesion(): void {
    this.auth.logout();
  }
}
