import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { ToastService } from '../../core/alertas/toast.service';
import { Rol } from '../../core/models/common.models';
import { rolesGestionables } from '../../core/permisos';
import { CuentaInterna, CuentasApi } from '../../core/service/cuentas-api';
import { rolLabel } from '../../core/ui/labels';
import { CargaError } from '../../shared/carga-error/carga-error';

/** Gestión de las cuentas del panel (contable, Recursos Humanos). */
@Component({
  selector: 'app-admin-cuentas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CargaError],
  templateUrl: './admin-cuentas-page.html',
})
export class AdminCuentasPage {
  private readonly api = inject(CuentasApi);
  private readonly toast = inject(ToastService);

  readonly roles = rolesGestionables();
  readonly rolLabel = rolLabel;

  readonly cuentas = signal<CuentaInterna[]>([]);
  readonly cargando = signal(false);
  readonly errorCarga = signal(false);
  readonly enviando = signal(false);
  readonly porDesactivar = signal<CuentaInterna | null>(null);

  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    rol: new FormControl<Rol>(this.roles[0], { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.api.listar().subscribe({
      next: (cuentas) => {
        this.cuentas.set(cuentas);
        this.cargando.set(false);
      },
      error: () => {
        this.cuentas.set([]);
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }

  crear(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const cuenta = this.form.getRawValue();
    this.enviando.set(true);
    this.api.crear(cuenta).subscribe({
      next: () => {
        this.enviando.set(false);
        // La entrega del correo no se puede confirmar: no se promete que llegó.
        this.toast.success(
          'Cuenta creada',
          `Enviamos la invitación a ${cuenta.correo}. Si no llega, la persona puede usar «Recuperar contraseña».`,
        );
        this.form.reset();
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        avisarErrorAccion(this.toast, 'No se pudo crear la cuenta', err, {
          409: 'Ya existe una cuenta con ese correo.',
        });
      },
    });
  }

  confirmarDesactivar(): void {
    const cuenta = this.porDesactivar();
    if (!cuenta) return;
    this.porDesactivar.set(null);
    this.cambiarEstado(cuenta, false);
  }

  cambiarEstado(cuenta: CuentaInterna, activa: boolean): void {
    this.api.cambiarEstado(cuenta.id, activa).subscribe({
      next: () => this.cargar(),
      error: (err) => avisarErrorAccion(this.toast, 'No se pudo cambiar la cuenta', err),
    });
  }
}
