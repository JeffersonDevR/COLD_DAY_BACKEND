import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { TecnicosApi } from '../../modules/tecnicos/infrastructure/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { TecnicoResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-validacion-tecnicos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './validacion-tecnicos-page.html'
})
export class ValidacionTecnicosPage {
  private readonly adminApi = inject(AdminApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly tecnicos = signal<TecnicoResponse[]>([]);
  readonly tecnicoARechazar = signal<TecnicoResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  constructor() {
    this.cargarTecnicos();
  }

  private cargarTecnicos(): void {
    this.tecnicosApi.getTecnicos().subscribe({
      next: (tecnicos) => this.tecnicos.set(tecnicos),
      error: () => this.tecnicos.set([]),
    });
  }

  aprobar(tec: TecnicoResponse): void {
    this.adminApi.validarDocumentacionTecnico(tec.id, 'APROBADO').subscribe({
      next: () => {
        this.toast.success('Técnico Aprobado', `${tec.nombreCompleto} ha sido habilitado para tomar servicios en Cúcuta.`);
        this.cargarTecnicos();
      }
    });
  }

  abrirModalRechazo(tec: TecnicoResponse): void {
    this.tecnicoARechazar.set(tec);
  }

  confirmarRechazo(): void {
    const tec = this.tecnicoARechazar();
    if (!tec || this.motivoCtrl.invalid) return;

    this.adminApi.validarDocumentacionTecnico(tec.id, 'RECHAZADO', this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Técnico Rechazado', `Se notificó el motivo a ${tec.nombreCompleto}.`);
        this.tecnicoARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargarTecnicos();
      }
    });
  }
}
