import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PanelTecnicoPage } from './panel-tecnico-page';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';

const tecnico: TecnicoResponse = {
  id: 'TEC-1',
  nombre: 'Juan',
  nombreCompleto: 'Juan Pérez',
  correo: 'j@x.co',
  estadoOperativo: 'DISPONIBLE',
  deudaComisionCop: 0,
};

function ot(id: string, estado: OtResponse['estado']): OtResponse {
  return { id, categoriaServicio: 'REFRIGERACION', descripcionFalla: 'x', estado, auxiliaresRequeridos: 0 };
}

function setup(opts: { tecnico?: TecnicoResponse | undefined; ots?: OtResponse[] } = {}) {
  const tecnicosApi = {
    getTecnicoPorUsuarioId: vi.fn(() => of(opts.tecnico ?? tecnico)),
    getMisOts: vi.fn(() => of(opts.ots ?? [ot('a', 'EN_CAMINO'), ot('b', 'FINALIZADA')])),
    actualizarEstadoOperativo: vi.fn(() => of(true)),
  };
  const toast = { info: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PanelTecnicoPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PanelTecnicoPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast, navigate };
}

describe('PanelTecnicoPage', () => {
  it('carga el técnico y filtra las OTs en curso', () => {
    const { fixture, tecnicosApi } = setup();
    expect(tecnicosApi.getMisOts).toHaveBeenCalled();
    expect(fixture.componentInstance.misOtsEnCurso().map((o) => o.id)).toEqual(['a']);
  });

  it('cambia el estado operativo y avisa', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.cambiarEstadoOperativo('FUERA_DE_SERVICIO');
    expect(tecnicosApi.actualizarEstadoOperativo).toHaveBeenCalledWith('TEC-1', 'FUERA_DE_SERVICIO');
    expect(fixture.componentInstance.tecnico()?.estadoOperativo).toBe('FUERA_DE_SERVICIO');
    expect(toast.info).toHaveBeenCalled();
  });

  it('muestra error si el backend rechaza el cambio de estado', () => {
    const { fixture, tecnicosApi, toast } = setup();
    tecnicosApi.actualizarEstadoOperativo.mockReturnValue(throwError(() => new Error('OT activa')));
    fixture.componentInstance.cambiarEstadoOperativo('DISPONIBLE');
    expect(toast.error).toHaveBeenCalledWith('No se pudo cambiar el estado', 'OT activa');
  });

  it('navega al radar de ofertas', () => {
    const { fixture, navigate } = setup();
    fixture.componentInstance.irAOfertas();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ofertas']);
  });

  it('muestra el estado vacío sin servicios asignados', () => {
    const { fixture } = setup({ ots: [] });
    expect(fixture.nativeElement.textContent).toContain('No tienes servicios asignados');
  });
});
