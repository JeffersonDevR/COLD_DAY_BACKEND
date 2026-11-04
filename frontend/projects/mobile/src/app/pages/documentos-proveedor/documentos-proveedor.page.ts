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
import { MobileToastService } from '../../core/toast.service';

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

  ngOnInit(): void {
    this.cargar();
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
        return 'Tu documentación fue aprobada. Ya podés aceptar pedidos de insumos.';
      case 'RECHAZADO':
        return 'Tu documentación fue rechazada. Corregí lo indicado y volvé a declararla.';
      case 'PENDIENTE':
        return 'Un administrador todavía revisa tu expediente. Mientras tanto no podés aceptar pedidos.';
      default:
        return 'No conocemos el estado de validación de esta sesión. Volvé a iniciar sesión o contactá al administrador.';
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
}
