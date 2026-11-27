import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
  IonRefresher,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import {
  DocumentoProveedorResponse,
  EstadoValidacionProveedor,
  TipoDocumentoProveedor,
} from '@core/models/common.models';
import { ResumenVigencia, resumenVigencia } from '@core/service/documentos-vigencia';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { documentoLabel } from '@core/ui/labels';
import { MobileToastService } from '../../core/toast.service';
import { DeclaracionDocumento, DocumentoFormComponent, OpcionTipoDocumento } from '../../shared/ui/documento-form/documento-form';
import { DocumentoVista, DocumentosListaComponent } from '../../shared/ui/documentos-lista/documentos-lista';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { Observable, tap, forkJoin, catchError, of } from 'rxjs';
import { ContenidoRecargaComponent, RecargarDirective } from '../../shared/recargar';

/**
 * C2 — Documentos de la empresa (proveedor): tipo y vencimiento, sin archivo (el
 * backend no lo recibe). Usa la misma lista y el mismo formulario que el técnico;
 * cambian los tipos (de empresa) y que el vencimiento es opcional, porque el RUT
 * o la certificación bancaria pueden no vencer.
 */
@Component({
  selector: 'app-documentos-proveedor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonRefresher,
    RecargarDirective,
    ContenidoRecargaComponent,
    ReactiveFormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonSpinner,
    IonToolbar,
    DocumentoFormComponent,
    DocumentosListaComponent,
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

  /** Tipos que una empresa puede declarar (los heredados `CEDULA` y `CERTIFICADO` ya no se ofrecen). */
  readonly tiposDocumento: readonly OpcionTipoDocumento[] = (
    ['RUT', 'CAMARA_COMERCIO', 'CEDULA_REPRESENTANTE', 'CERTIFICACION_BANCARIA', 'OTRO'] as const
  ).map((valor) => ({ valor, etiqueta: documentoLabel(valor) }));

  readonly documentosVista = computed<DocumentoVista[]>(() =>
    this.documentos().map((documento) => ({
      id: String(documento.id),
      titulo: documentoLabel(documento.tipo as TipoDocumentoProveedor),
      vencimiento: documento.fechaVencimiento,
    })),
  );

  readonly resumenDocumentos = computed<ResumenVigencia>(() =>
    resumenVigencia(this.documentos().map((d) => ({ fechaVencimiento: d.fechaVencimiento }))),
  );

  /** Datos comerciales: el alta ya no los pide, se completan aquí. `null` mientras carga. */
  readonly datosCompletos = signal<boolean | null>(null);
  readonly guardandoDatos = signal(false);
  readonly datosForm = new FormGroup({
    razonSocial: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Deslizar: actualiza documentos y validación sin tocar lo que se esté escribiendo. */
  readonly recargar = (): Observable<unknown> =>
    forkJoin([
      this.proveedoresApi.getMisDocumentos(),
      this.proveedoresApi.getMiPerfil().pipe(catchError(() => of(null))),
    ]).pipe(
      tap(([documentos, perfil]) => {
        this.documentos.set(documentos);
        if (perfil?.estadoValidacion) this.estadoValidacion.set(perfil.estadoValidacion);
      }),
    );

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

  registrar(declaracion: DeclaracionDocumento): void {
    if (this.guardando()) return;

    this.guardando.set(true);
    this.proveedoresApi.registrarDocumento(declaracion.tipo, declaracion.fechaVencimiento).subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
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

  /** "1 vencido y 2 por vencer", para el aviso de arriba. */
  textoAvisoDocumentos(resumen: ResumenVigencia): string {
    const partes: string[] = [];
    if (resumen.vencidos > 0) {
      partes.push(`${resumen.vencidos} ${resumen.vencidos === 1 ? 'vencido' : 'vencidos'}`);
    }
    if (resumen.porVencer > 0) {
      partes.push(`${resumen.porVencer} por vencer`);
    }
    return `Tienes ${partes.join(' y ')}. Renuévalos para no perder la validación.`;
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
