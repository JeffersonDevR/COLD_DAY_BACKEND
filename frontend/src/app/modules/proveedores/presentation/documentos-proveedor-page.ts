import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresApi } from '../infrastructure/proveedores-api';
import { ProveedorRegistroService } from '../infrastructure/proveedor-registro.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import {
  DocumentoProveedorResponse,
  EstadoValidacionProveedor,
  TipoDocumentoProveedor,
} from '../../../core/models/common.models';

type TonoEstado = 'pendiente' | 'ok' | 'error';

/**
 * Expediente documental del proveedor (rol PROVEEDOR).
 *
 * Es la pantalla de aterrizaje del proveedor recién auto-registrado, porque su
 * cuenta nace `PENDIENTE`: sin validación no puede aceptar insumos, así que el
 * panel de solicitudes le respondería 403 sin explicar por qué.
 *
 * Los documentos son declaraciones de metadata (tipo + fecha de vencimiento):
 * el backend no tiene upload ni almacenamiento de archivos, y esta pantalla no
 * inventa un campo que el contrato no tiene.
 */
@Component({
  selector: 'app-documentos-proveedor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-4xl mx-auto">
      <div>
        <a routerLink="/proveedor/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <i class="pi pi-arrow-left text-xs"></i> Volver al Portal de Proveedores
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Expediente y Validación
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Declara tu documentación para que un administrador pueda validar tu empresa.
        </p>
      </div>

      <!-- Estado de validación: la razón por la que aún no hay pedidos -->
      <section
        class="p-5 rounded-3xl border flex items-start gap-4"
        [class]="claseEstado(tonoEstado(estadoValidacion()))"
        data-testid="estado-validacion"
      >
        <i class="pi text-2xl" [class]="iconoEstado(tonoEstado(estadoValidacion()))"></i>
        <div class="min-w-0">
          <h2 class="text-sm font-bold" [class]="textoEstado(tonoEstado(estadoValidacion()))">
            Estado de validación: {{ estadoValidacion() ?? 'DESCONOCIDO' }}
          </h2>
          <p class="text-xs mt-1" [class]="textoEstado(tonoEstado(estadoValidacion()))">
            {{ explicacionEstado(estadoValidacion()) }}
          </p>
        </div>
      </section>

      @if (razonSocial()) {
        <p class="text-xs text-slate-500">
          Empresa registrada: <strong class="text-slate-700 dark:text-slate-300">{{ razonSocial() }}</strong>
          · NIT {{ nit() }}
        </p>
      }

      <section class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Documentos declarados</h2>
          <button
            type="button"
            (click)="mostrarForm.set(!mostrarForm())"
            class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 transition-colors"
          >
            <i class="pi pi-plus text-xs"></i>
            Declarar documento
          </button>
        </div>

        @if (mostrarForm()) {
          <form [formGroup]="docForm" (ngSubmit)="onRegistrarDoc()" class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label for="tipo-doc" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo *</label>
                <select id="tipo-doc" formControlName="tipo" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
                  <option value="RUT">RUT</option>
                  <option value="CEDULA">Cédula del representante</option>
                  <option value="CERTIFICADO">Certificado empresarial</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label for="fecha-vencimiento" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Fecha de vencimiento *</label>
                <input id="fecha-vencimiento" type="date" formControlName="fechaVencimiento" class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs" />
              </div>
            </div>
            <p class="text-[11px] text-slate-500">
              Solo se declara el tipo y la fecha de vencimiento: no hay carga de archivos.
            </p>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="mostrarForm.set(false)" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600">Cancelar</button>
              <button type="submit" [disabled]="docForm.invalid" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Guardar</button>
            </div>
          </form>
        }

        <ul class="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          @for (doc of documentos(); track doc.id) {
            <li class="flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm">
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ doc.tipo }}</span>
              <span class="text-slate-500">Vence: {{ doc.fechaVencimiento ?? 'sin fecha' }}</span>
            </li>
          } @empty {
            <li class="px-3.5 py-8 text-center text-xs text-slate-500">
              Todavía no has declarado ningún documento. Sin al menos uno vigente el administrador no puede aprobarte.
            </li>
          }
        </ul>
      </section>
    </div>
  `
})
export class DocumentosProveedorPage {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly registro = inject(ProveedorRegistroService);
  private readonly toast = inject(ToastService);

  readonly mostrarForm = signal<boolean>(false);
  readonly documentos = signal<DocumentoProveedorResponse[]>([]);

  /**
   * El backend no expone `GET /api/proveedores/me`, así que el estado se toma
   * del alta de esta sesión. Si no hubo alta en esta pestaña se muestra
   * `undefined` y la pantalla lo dice en vez de inventar un `APROBADO`.
   */
  readonly estadoValidacion = signal<EstadoValidacionProveedor | undefined>(this.registro.estadoValidacion());
  readonly razonSocial = signal<string>(this.registro.registro()?.razonSocial ?? '');
  readonly nit = signal<string>(this.registro.registro()?.nit ?? '');

  readonly docForm = new FormGroup({
    tipo: new FormControl<TipoDocumentoProveedor>('RUT', { nonNullable: true, validators: [Validators.required] }),
    fechaVencimiento: new FormControl('2027-12-31', { nonNullable: true, validators: [Validators.required] })
  });

  constructor() {
    this.cargarDocumentos();
  }

  private cargarDocumentos(): void {
    this.proveedoresApi.getMisDocumentos().subscribe({
      next: (documentos) => this.documentos.set(documentos),
      error: () => this.documentos.set([]),
    });
  }

  onRegistrarDoc(): void {
    if (this.docForm.invalid) return;
    const { tipo, fechaVencimiento } = this.docForm.getRawValue();
    this.proveedoresApi.registrarDocumento(tipo, fechaVencimiento).subscribe({
      next: () => {
        this.toast.success('Documento declarado', 'Un administrador revisará tu expediente.');
        this.mostrarForm.set(false);
        this.cargarDocumentos();
      },
      error: () => {
        this.toast.error('No se pudo declarar', 'Intenta de nuevo en un momento.');
      },
    });
  }

  tonoEstado(estado: EstadoValidacionProveedor | undefined): TonoEstado {
    switch (estado) {
      case 'APROBADO': return 'ok';
      case 'RECHAZADO': return 'error';
      default: return 'pendiente';
    }
  }

  explicacionEstado(estado: EstadoValidacionProveedor | undefined): string {
    switch (estado) {
      case 'APROBADO':
        return 'Tu documentación fue aprobada. Ya puedes aceptar pedidos de insumos.';
      case 'RECHAZADO':
        return 'Tu documentación fue rechazada. Corrige lo indicado y vuelve a declararla.';
      case 'PENDIENTE':
        return 'Un administrador aún revisa tu expediente. Mientras tanto no puedes aceptar pedidos de insumos.';
      default:
        return 'No conocemos el estado de validación de esta sesión. Vuelve a iniciar sesión o contacta al administrador.';
    }
  }

  claseEstado(tono: TonoEstado): string {
    switch (tono) {
      case 'ok': return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
      case 'error': return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
      default: return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    }
  }

  iconoEstado(tono: TonoEstado): string {
    switch (tono) {
      case 'ok': return 'pi-verified text-emerald-600';
      case 'error': return 'pi-exclamation-circle text-rose-600';
      default: return 'pi-clock text-amber-600';
    }
  }

  textoEstado(tono: TonoEstado): string {
    switch (tono) {
      case 'ok': return 'text-emerald-800 dark:text-emerald-200';
      case 'error': return 'text-rose-800 dark:text-rose-200';
      default: return 'text-amber-800 dark:text-amber-200';
    }
  }
}
