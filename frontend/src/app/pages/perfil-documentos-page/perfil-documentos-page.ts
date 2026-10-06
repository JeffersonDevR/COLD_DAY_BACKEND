import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { ToastService } from '../../core/alertas/toast.service';
import { TipoDocumentoTecnico, DocumentoTecnicoResponse, TecnicoResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-perfil-documentos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './perfil-documentos-page.html',
})
export class PerfilDocumentosPage {
  private readonly authService = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  readonly mostrarForm = signal<boolean>(false);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly documentos = signal<DocumentoTecnicoResponse[]>([]);

  readonly docForm = new FormGroup({
    tipo: new FormControl<TipoDocumentoTecnico>('CERTIFICACION_SENA', { nonNullable: true }),
    fechaVencimiento: new FormControl('2027-12-31', { nonNullable: true, validators: [Validators.required] }),
    archivoUrl: new FormControl('https://coldday.com.co/docs/certificacion.pdf', { nonNullable: true, validators: [Validators.required] })
  });

  constructor() {
    cargarTecnicoAutenticado(this.authService, this.tecnicosApi, (tecnico) => this.tecnico.set(tecnico));
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
    this.tecnicosApi.subirDocumento(t.id, val.tipo, val.archivoUrl, val.fechaVencimiento).subscribe({
      next: () => {
        this.toast.success('Documento Adjuntado', 'El archivo ha sido enviado para verificación del administrador.');
        this.mostrarForm.set(false);
        this.cargarDocumentos();
      }
    });
  }
}
