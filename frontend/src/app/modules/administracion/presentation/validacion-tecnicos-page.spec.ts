import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ValidacionTecnicosPage } from './validacion-tecnicos-page';
import { AdminApi } from '../infrastructure/admin-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { TecnicoResponse } from '../../../core/shared/domain/models/common.models';

const tecnico: TecnicoResponse = {
  id: 'TEC-1',
  nombre: 'Juan Pérez',
  nombreCompleto: 'Juan Pérez',
  correo: 'j@x.co',
  telefono: '300',
  cedula: '123',
  categorias: ['REFRIGERACION'],
  estadoValidacion: 'EN_REVISION',
  documentos: [{ id: 'DOC-1', tipo: 'CEDULA', nombre: 'cedula.pdf', estadoValidacion: 'PENDIENTE' }],
};

function setup() {
  const adminApi = { validarDocumentacionTecnico: vi.fn(() => of(undefined)) };
  const tecnicosApi = { getTecnicos: vi.fn(() => of([tecnico])) };
  const toast = { success: vi.fn(), warning: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ValidacionTecnicosPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: adminApi },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(ValidacionTecnicosPage);
  fixture.detectChanges();
  return { fixture, adminApi, toast };
}

describe('ValidacionTecnicosPage', () => {
  it('carga los técnicos al iniciar', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.tecnicos().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Juan Pérez');
  });

  it('aprueba y habilita al técnico', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.aprobar(tecnico);
    expect(adminApi.validarDocumentacionTecnico).toHaveBeenCalledWith('TEC-1', 'APROBADO');
    expect(toast.success).toHaveBeenCalled();
  });

  it('confirma el rechazo con motivo', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('documentos vencidos');

    fixture.componentInstance.confirmarRechazo();

    expect(adminApi.validarDocumentacionTecnico).toHaveBeenCalledWith('TEC-1', 'RECHAZADO', 'documentos vencidos');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.tecnicoARechazar()).toBeNull();
  });

  it('no rechaza sin motivo válido', () => {
    const { fixture, adminApi } = setup();
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('x');

    fixture.componentInstance.confirmarRechazo();

    expect(adminApi.validarDocumentacionTecnico).not.toHaveBeenCalled();
  });
});
