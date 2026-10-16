import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { ToastService } from '../../core/alertas/toast.service';
import { mensajeErrorAccion } from '../../core/alertas/mensaje-error';
import { TipoDocumentoTecnico, DocumentoTecnicoResponse, TecnicoResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-perfil-documentos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './perfil-documentos-page.html',
})
export class PerfilDocumentosPage {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly mostrarForm = signal<boolean>(false);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly documentos = signal<DocumentoTecnicoResponse[]>([]);

  readonly docForm = new FormGroup({
    tipo: new FormControl<TipoDocumentoTecnico>('CERTIFICACION_SENA', { nonNullable: true }),
    fechaExpedicion: new FormControl('2025-01-01', { nonNullable: true, validators: [Validators.required] }),
    fechaVencimiento: new FormControl('', { nonNullable: true }),
    archivoUrl: new FormControl('https://coldday.com.co/docs/certificacion.pdf', { nonNullable: true, validators: [Validators.required] })
  });

  constructor() {
    cargarTecnicoAutenticado(this.tecnicosApi, (tecnico) => this.tecnico.set(tecnico));
    this.cargarDocumentos();
  }

  private cargarDocumentos(): void {
    this.tecnicosApi.getMisDocumentos().subscribe({
      next: (documentos) => this.documentos.set(documentos),
      error: () => this.documentos.set([]),
    });
  }

  onSubirDoc(): void {
    if (this.docForm.invalid) return;
    const t = this.tecnico();
    if (!t) return;

    const val = this.docForm.getRawValue();
    this.tecnicosApi
      .subirDocumento(t.id, val.tipo, val.archivoUrl, val.fechaExpedicion, val.fechaVencimiento || undefined)
      .subscribe({
      next: () => {
        this.toast.success('Documento Adjuntado', 'El archivo ha sido enviado para verificación del administrador.');
        this.mostrarForm.set(false);
        this.cargarDocumentos();
      },
      // El formulario queda abierto con los datos cargados para que el técnico reintente.
      error: (err) => {
        this.toast.error('No se pudo subir el documento', mensajeErrorAccion(err));
      },
    });
  }
}
