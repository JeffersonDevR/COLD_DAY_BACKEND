import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { DisputaResponse } from '../../core/models/common.models';
import { CargaError } from '../../shared/carga-error/carga-error';

@Component({
  selector: 'app-disputas-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, CargaError],
  templateUrl: './disputas-admin-page.html'
})
export class DisputasAdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly disputas = signal<DisputaResponse[]>([]);
  readonly disputaSeleccionada = signal<DisputaResponse | null>(null);
  readonly resolucionCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] });

  /** Carga silenciosa: si falla, la bandeja lo dice y ofrece reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  constructor() {
    this.cargarDisputas();
  }

  cargarDisputas(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.adminApi.getTodasDisputas().subscribe({
      next: (disputas) => {
        this.disputas.set(disputas);
        this.cargando.set(false);
      },
      error: () => {
        this.disputas.set([]);
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }

  abrirResolucion(d: DisputaResponse): void {
    this.disputaSeleccionada.set(d);
  }

  resolver(acuerdo: boolean): void {
    const d = this.disputaSeleccionada();
    if (!d || this.resolucionCtrl.invalid) return;

    const admin = this.authService.currentUser()?.nombre || 'Administrador COLD DAY';
    this.adminApi.resolverDisputa(d.id, this.resolucionCtrl.value, acuerdo, admin).subscribe({
      next: () => {
        this.toast.success('Disputa Resuelta', `La disputa de la OT ${d.otCodigo || 'Sin código'} ha sido conciliada satisfactoriamente.`);
        this.disputaSeleccionada.set(null);
        this.resolucionCtrl.reset();
        this.cargarDisputas();
      },
      // El modal queda abierto con el dictamen escrito para que el admin reintente.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo resolver la disputa', err);
      },
    });
  }
}
