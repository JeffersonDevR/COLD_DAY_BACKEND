import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../infrastructure/admin-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { ProveedorResponse } from '../../../core/shared/domain/models/common.models';

/**
 * Alta y listado de proveedores para el administrador. El rol PROVEEDOR y la
 * contraseña inicial los define el admin en el alta; el listado incluye
 * proveedores inactivos (P4). No hay auto-registro público (D7).
 */
@Component({
  selector: 'app-proveedores-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">Proveedores Auxiliares</h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Alta administrada de proveedores de insumos. El acceso al portal es exclusivo del rol PROVEEDOR.
        </p>
      </div>

      <form [formGroup]="form" (ngSubmit)="crear()"
        class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Nuevo proveedor</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (field of campos; track field.key) {
            <label class="block">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{{ field.label }}</span>
              <input [type]="field.type" [formControlName]="field.key"
                class="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
            </label>
          }
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" formControlName="aceptaHabeasData" class="rounded" />
          El proveedor acepta el tratamiento de datos personales (Habeas Data).
        </label>
        <div class="flex justify-end">
          <button type="submit" [disabled]="form.invalid || enviando()"
            class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors">
            {{ enviando() ? 'Creando...' : 'Crear proveedor' }}
          </button>
        </div>
      </form>

      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Proveedores registrados</h2>
        <div class="divide-y divide-slate-200/70 dark:divide-slate-700/70">
          @for (prov of proveedores(); track prov.id) {
            <div class="flex items-center justify-between gap-3 py-3">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ prov.razonSocial }}</p>
                <p class="text-xs text-slate-500">NIT: {{ prov.nit }} • Tel: {{ prov.telefono || '—' }}</p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                [class.bg-emerald-100]="prov.activo" [class.text-emerald-800]="prov.activo"
                [class.bg-slate-200]="!prov.activo" [class.text-slate-600]="!prov.activo">
                {{ prov.activo ? 'ACTIVO' : 'INACTIVO' }}
              </span>
            </div>
          } @empty {
            <p class="text-xs text-slate-500 py-3">Aún no hay proveedores registrados.</p>
          }
        </div>
      </div>
    </div>
  `
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
