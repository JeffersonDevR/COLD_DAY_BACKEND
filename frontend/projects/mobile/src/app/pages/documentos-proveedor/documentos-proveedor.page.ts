import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import {
  DocumentoProveedorResponse,
  EstadoValidacionProveedor,
  TipoDocumentoProveedor,
} from '@core/models/common.models';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { documentoLabel } from '@core/ui/labels';
import { MobileToastService } from '../../core/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/** C2 — Provider documents: metadata only (no upload exists in the backend). */
@Component({
  selector: 'app-documentos-proveedor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonToolbar,
    SkeletonComponent,
    EmptyStateComponent,
    MarcaBarraComponent,
  ],
  templateUrl: './documentos-proveedor.page.html',
})
export class DocumentosProveedorPage implements OnInit {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly registro = inject(ProveedorRegistroService);
  private readonly toast = inject(MobileToastService);

  readonly documentos = signal<DocumentoProveedorResponse[]>([]);
  readonly cargando = signal(true);
  readonly mostrarForm = signal(false);
  readonly guardando = signal(false);

  readonly estadoValidacion = signal<EstadoValidacionProveedor | undefined>(
    this.registro.estadoValidacion(),
  );

  readonly docForm = new FormGroup({
    tipo: new FormControl<TipoDocumentoProveedor>('RUT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaVencimiento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Datos comerciales: el alta ya no los pide, se completan aquí. `null` mientras carga. */
  readonly datosCompletos = signal<boolean | null>(null);
  readonly guardandoDatos = signal(false);
  readonly datosForm = new FormGroup({
    razonSocial: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.cargar();
    this.cargarPerfil();
  }

  private cargarPerfil(): void {
    this.proveedoresApi.getMiPerfil().subscribe({
      next: (perfil) => {
        this.datosCompletos.set(perfil.razonSocial.trim() !== '' && perfil.nit.trim() !== '');
        if (perfil.estadoValidacion) this.estadoValidacion.set(perfil.estadoValidacion);
      },
      // Sin lectura no se bloquea nada: el formulario solo aparece si sabemos que faltan.
      error: () => this.datosCompletos.set(true),
    });
  }

  guardarDatos(): void {
    if (this.datosForm.invalid || this.guardandoDatos()) return;
    const { razonSocial, nit } = this.datosForm.getRawValue();
    this.guardandoDatos.set(true);
    this.proveedoresApi.completarMiPerfil(razonSocial.trim(), nit.trim()).subscribe({
      next: () => {
        this.guardandoDatos.set(false);
        this.datosCompletos.set(true);
        void this.toast.success('Datos guardados', 'Ya puedes declarar tus documentos.');
      },
      error: (err: Error) => {
        this.guardandoDatos.set(false);
        void avisarErrorAccion(this.toast, 'No se pudieron guardar los datos', err);
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.proveedoresApi.getMisDocumentos().subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: () => {
        this.documentos.set([]);
        this.cargando.set(false);
      },
    });
  }

  alternarForm(): void {
    this.mostrarForm.update((visible) => !visible);
  }

  registrar(): void {
    if (this.docForm.invalid || this.guardando()) return;

    const valor = this.docForm.getRawValue();
    this.guardando.set(true);
    this.proveedoresApi.registrarDocumento(valor.tipo, valor.fechaVencimiento).subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.docForm.reset({ tipo: 'RUT', fechaVencimiento: '' });
        this.cargar();
        void this.toast.success(
          'Documento declarado',
          'Un administrador va a revisar tu expediente.',
        );
      },
      error: (err: Error) => {
        this.guardando.set(false);
        void avisarErrorAccion(this.toast, 'No se pudo declarar el documento', err);
      },
    });
  }

  explicacionEstado(): string {
    switch (this.estadoValidacion()) {
      case 'APROBADO':
        return 'Tu documentación fue aprobada. Ya puedes aceptar pedidos de insumos.';
      case 'RECHAZADO':
        return 'Tu documentación fue rechazada. Corrige lo indicado y vuelve a declararla.';
      case 'PENDIENTE':
        return 'Un administrador todavía revisa tu expediente. Mientras tanto no puedes aceptar pedidos.';
      default:
        return 'No conocemos el estado de validación de esta sesión. Vuelve a iniciar sesión o contacta al administrador.';
    }
  }

  tonoEstado(): string {
    switch (this.estadoValidacion()) {
      case 'APROBADO':
        return 'ok';
      case 'RECHAZADO':
        return 'cerrada';
      default:
        return 'espera';
    }
  }

  /** Etiqueta canónica del tipo (labels.ts); el backend expone el enum como string. */
  etiquetaDocumento(tipo: string): string {
    return documentoLabel(tipo as TipoDocumentoProveedor);
  }
}
