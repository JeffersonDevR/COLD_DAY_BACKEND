import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ValidacionTecnicosPage } from './validacion-tecnicos-page';
import { AdminApi } from '../../core/service/admin-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { TecnicoResponse } from '../../core/models/common.models';

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

/** Mensaje humano esperado para el 409 de documentación incompleta/vencida. */
const MENSAJE_409 =
  'El expediente del técnico no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo.';

function setup(validarError?: unknown) {
  const adminApi = {
    validarDocumentacionTecnico: vi.fn(() =>
      validarError ? throwError(() => validarError) : of(undefined)
    ),
  };
  const tecnicosApi = { getTecnicos: vi.fn(() => of([tecnico])) };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
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
  return { fixture, adminApi, tecnicosApi, toast };
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

  it('ante un 409 avisa con copy humana y deja la fila intacta (sin recargar)', () => {
    const { fixture, tecnicosApi, toast } = setup(
      new ApiHttpError('Documentacion incompleta o vencida del técnico TEC-1', 409)
    );

    fixture.componentInstance.aprobar(tecnico);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo habilitar al técnico', MENSAJE_409);
    // Solo la carga inicial del constructor: el fallo no dispara refetch.
    expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.tecnicos().length).toBe(1);
  });

  it('ante un fallo del rechazo mantiene el modal y el motivo para reintentar', () => {
    const { fixture, tecnicosApi, toast } = setup(
      new ApiHttpError('Tecnico no encontrado: TEC-1', 404)
    );
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('documentos vencidos');

    fixture.componentInstance.confirmarRechazo();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo rechazar la validación',
      'El técnico ya no está registrado. Actualiza la lista e inténtalo de nuevo.'
    );
    expect(fixture.componentInstance.tecnicoARechazar()).not.toBeNull();
    expect(fixture.componentInstance.motivoCtrl.value).toBe('documentos vencidos');
    expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);
  });
});
