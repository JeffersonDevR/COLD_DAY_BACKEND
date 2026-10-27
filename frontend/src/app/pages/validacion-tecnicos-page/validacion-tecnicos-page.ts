import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { TecnicoResponse } from '../../core/models/common.models';
import { CargaError } from '../../shared/carga-error/carga-error';

/**
 * Copy propia de esta pantalla: el 409 de este endpoint es
 * `DocumentacionIncompletaException`, o sea que el expediente del técnico no
 * está vigente. Reintentar no sirve, así que el mensaje debe decir qué hacer.
 */
const MENSAJES_VALIDACION: Record<number, string> = {
  409: 'El expediente del técnico no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo.',
  404: 'El técnico ya no está registrado. Actualiza la lista e inténtalo de nuevo.',
};

@Component({
  selector: 'app-validacion-tecnicos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, CargaError],
  templateUrl: './validacion-tecnicos-page.html'
})
export class ValidacionTecnicosPage {
  private readonly adminApi = inject(AdminApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly tecnicos = signal<TecnicoResponse[]>([]);
  readonly tecnicoARechazar = signal<TecnicoResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  /** Carga silenciosa: si falla, la pantalla lo dice y ofrece reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  constructor() {
    this.cargarTecnicos();
  }

  cargarTecnicos(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.tecnicosApi.getTecnicos().subscribe({
      next: (tecnicos) => {
        this.tecnicos.set(tecnicos);
        this.cargando.set(false);
      },
      error: () => {
        this.tecnicos.set([]);
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }

  aprobar(tec: TecnicoResponse): void {
    this.adminApi.validarDocumentacionTecnico(tec.id, 'APROBADO').subscribe({
      next: () => {
        this.toast.success('Técnico Aprobado', `${tec.nombreCompleto} ha sido habilitado para tomar servicios en Cúcuta.`);
        this.cargarTecnicos();
      },
      // Sin recargar: la fila sigue en pantalla y el admin ve por qué no se habilitó.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo habilitar al técnico', err, MENSAJES_VALIDACION);
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
      },
      // El modal queda abierto y el motivo escrito intacto para que el admin reintente.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo rechazar la validación', err, MENSAJES_VALIDACION);
      }
    });
  }
}
