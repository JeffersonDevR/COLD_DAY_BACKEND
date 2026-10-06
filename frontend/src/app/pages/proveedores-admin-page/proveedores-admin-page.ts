import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/service/admin-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ProveedorResponse } from '../../core/models/common.models';

/**
 * Alta y listado de proveedores para el administrador. El rol PROVEEDOR y la
 * contraseña inicial los define el admin en el alta; el listado incluye
 * proveedores inactivos (P4). No hay auto-registro público (D7).
 */
@Component({
  selector: 'app-proveedores-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './proveedores-admin-page.html'
})
export class ProveedoresAdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly proveedores = signal<ProveedorResponse[]>([]);
  readonly enviando = signal(false);

  readonly campos = [
    { key: 'nombre', label: 'Nombre del contacto', type: 'text' },
    { key: 'correo', label: 'Correo', type: 'email' },
    { key: 'password', label: 'Contraseña inicial', type: 'password' },
    { key: 'telefono', label: 'Teléfono', type: 'text' },
    { key: 'razonSocial', label: 'Razón social', type: 'text' },
    { key: 'nit', label: 'NIT', type: 'text' },
  ] as const;

  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    telefono: new FormControl('', { nonNullable: true }),
    razonSocial: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    aceptaHabeasData: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.adminApi.getProveedores().subscribe({
      next: (proveedores) => this.proveedores.set(proveedores),
      error: () => this.proveedores.set([]),
    });
  }

  crear(): void {
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);
    this.adminApi.crearProveedor(this.form.getRawValue()).subscribe({
      next: (prov) => {
        this.toast.success('Proveedor creado', `${prov.razonSocial} ya puede operar con el rol PROVEEDOR.`);
        this.form.reset({ aceptaHabeasData: false });
        this.enviando.set(false);
        this.cargar();
      },
      error: () => {
        this.toast.warning('No se pudo crear', 'Revisa si el correo o el NIT ya están registrados.');
        this.enviando.set(false);
      },
    });
  }
}
