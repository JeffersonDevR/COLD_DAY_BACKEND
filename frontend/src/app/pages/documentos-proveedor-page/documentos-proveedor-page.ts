import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ProveedorRegistroService } from '../../core/service/proveedor-registro.service';
import { ToastService } from '../../core/alertas/toast.service';
import {
  DocumentoProveedorResponse,
  EstadoValidacionProveedor,
  TipoDocumentoProveedor,
} from '../../core/models/common.models';

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
  templateUrl: './documentos-proveedor-page.html'
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
