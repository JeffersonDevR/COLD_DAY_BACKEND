import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PerfilDocumentosPage } from './perfil-documentos-page';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { TecnicoResponse } from '../../../core/shared/domain/models/common.models';

const tecnico: TecnicoResponse = { id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' };

function setup(conTecnico = true) {
  const tecnicosApi = {
    getTecnicoPorUsuarioId: vi.fn(() => of(conTecnico ? tecnico : undefined)),
    getMisDocumentos: vi.fn(() => of([{ id: 'DOC-1', tipo: 'CEDULA', nombre: 'c.pdf', estadoValidacion: 'APROBADO', semaforo: 'VERDE' }])),
    subirDocumento: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PerfilDocumentosPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(PerfilDocumentosPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast };
}

describe('PerfilDocumentosPage', () => {
  it('carga el técnico y sus documentos', () => {
    const { fixture, tecnicosApi } = setup();
    expect(tecnicosApi.getTecnicoPorUsuarioId).toHaveBeenCalledWith(6);
    expect(fixture.componentInstance.tecnico()?.id).toBe('TEC-1');
    expect(fixture.componentInstance.documentos().length).toBe(1);
  });

  it('sube un documento y recarga', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.onSubirDoc();

    expect(tecnicosApi.subirDocumento).toHaveBeenCalledWith(
      'TEC-1',
      'CERTIFICACION_SENA',
      'https://coldday.com.co/docs/certificacion.pdf',
      '2027-12-31',
    );
    expect(toast.success).toHaveBeenCalled();
    expect(fixture.componentInstance.mostrarForm()).toBe(false);
  });

  it('no sube si el formulario es inválido', () => {
    const { fixture, tecnicosApi } = setup();
    fixture.componentInstance.docForm.controls.archivoUrl.setValue('');

    fixture.componentInstance.onSubirDoc();

    expect(tecnicosApi.subirDocumento).not.toHaveBeenCalled();
  });

  it('no sube si no hay perfil de técnico', () => {
    const { fixture, tecnicosApi } = setup(false);
    fixture.componentInstance.onSubirDoc();
    expect(tecnicosApi.subirDocumento).not.toHaveBeenCalled();
  });
});
