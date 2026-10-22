import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ToastService } from '../../core/alertas/toast.service';
import { mensajeErrorAccion } from '../../core/alertas/mensaje-error';
import { ProveedorResponse } from '../../core/models/common.models';

/**
 * Copy propia de esta pantalla: el 409 de este endpoint significa que el
 * expediente del proveedor no está completo o tiene documentos vencidos.
 * Reintentar no sirve, así que el mensaje debe decir qué hacer.
 */
const MENSAJES_VALIDACION: Record<number, string> = {
  409: 'El expediente del proveedor no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo.',
  404: 'El proveedor ya no está registrado. Actualiza la lista e inténtalo de nuevo.',
};

/**
 * Validación documental de proveedores para el administrador. El alta ya no
 * vive aquí: los proveedores se auto-registran desde la página pública
 * `/registro`. Esta pantalla solo lista (incluye inactivos, P4) y aprueba o
 * rechaza el expediente de cada proveedor.
 */
@Component({
  selector: 'app-proveedores-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './proveedores-admin-page.html'
})
export class ProveedoresAdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly toast = inject(ToastService);

  readonly proveedores = signal<ProveedorResponse[]>([]);
  readonly proveedorARechazar = signal<ProveedorResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.adminApi.getProveedores().subscribe({
      next: (proveedores) => this.proveedores.set(proveedores),
      error: () => this.proveedores.set([]),
    });
  }

  aprobar(prov: ProveedorResponse): void {
    this.proveedoresApi.validarDocumentacion(prov.id, 'APROBAR').subscribe({
      next: () => {
        this.toast.success('Proveedor aprobado', `${prov.razonSocial} puede operar como proveedor de insumos.`);
        this.cargar();
      },
      // Sin recargar: la fila sigue en pantalla y el admin ve por qué no se aprobó.
      error: (err) => {
        this.toast.error('No se pudo aprobar al proveedor', mensajeErrorAccion(err, MENSAJES_VALIDACION));
      }
    });
  }

  abrirModalRechazo(prov: ProveedorResponse): void {
    this.proveedorARechazar.set(prov);
  }

  confirmarRechazo(): void {
    const prov = this.proveedorARechazar();
    if (!prov || this.motivoCtrl.invalid) return;

    this.proveedoresApi.validarDocumentacion(prov.id, 'RECHAZAR', this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Proveedor rechazado', `Se notificó el motivo a ${prov.razonSocial}.`);
        this.proveedorARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargar();
      },
      // El modal queda abierto y el motivo escrito intacto para que el admin reintente.
      error: (err) => {
        this.toast.error('No se pudo rechazar la validación', mensajeErrorAccion(err, MENSAJES_VALIDACION));
      }
    });
  }
}
