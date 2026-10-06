import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { DisputaResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-disputas-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './disputas-admin-page.html'
})
export class DisputasAdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly disputas = signal<DisputaResponse[]>([]);
  readonly disputaSeleccionada = signal<DisputaResponse | null>(null);
  readonly resolucionCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] });

  constructor() {
    this.cargarDisputas();
  }

  private cargarDisputas(): void {
    this.adminApi.getTodasDisputas().subscribe({
      next: (disputas) => this.disputas.set(disputas),
      error: () => this.disputas.set([]),
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
        this.toast.success('Disputa Resuelta', `El caso ${d.id} ha sido conciliado satisfactoriamente.`);
        this.disputaSeleccionada.set(null);
        this.resolucionCtrl.reset();
        this.cargarDisputas();
      }
    });
  }
}
