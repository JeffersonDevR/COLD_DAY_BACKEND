import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OfertasPage } from './ofertas-page';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';

const ot: OtResponse = {
  id: 'OT-1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  estado: 'BUSCANDO_TECNICO',
  auxiliaresRequeridos: 0,
};

const oferta: OfertaTecnicoResponse = {
  id: 'OF-1',
  otId: 'OT-1',
  ot,
  tecnicoId: 'TEC-1',
  distanciaKm: 2,
  radioVigenteKm: 10,
  segundosRestantes: 42,
  estado: 'PENDIENTE',
  fechaCreacion: '2026-01-01T00:00:00Z',
};

function setup(tecnico: TecnicoResponse | undefined) {
  const tecnicosApi = {
    getTecnicoPorUsuarioId: vi.fn(() => of(tecnico)),
    getOfertasParaTecnico: vi.fn(() => of([oferta])),
    aceptarOferta: vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [OfertasPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(OfertasPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast, navigate };
}

describe('OfertasPage', () => {
  it('carga ofertas al resolver el perfil del técnico', () => {
    const { fixture, tecnicosApi } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledWith('TEC-1');
    expect(fixture.componentInstance.solicitudesDisponibles().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('OT-1');
  });

  it('acepta la oferta y navega a ejecución', () => {
    const { fixture, tecnicosApi, toast, navigate } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).toHaveBeenCalledWith('OF-1', 'TEC-1', 0);
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ejecucion', 'OT-1']);
    expect(fixture.componentInstance.loadingOt()).toBeNull();
  });

  it('bloquea la aceptación si el técnico está bloqueado', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'BLOQUEADO_POR_LIQUIDACION' });

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Operación Bloqueada', expect.any(String));
  });

  it('avisa si no hay oferta vigente para la OT', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    fixture.componentInstance.ofertas.set([]);

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Sin Oferta Vigente', expect.any(String));
  });

  it('reporta error de concurrencia al fallar la aceptación', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    tecnicosApi.aceptarOferta.mockReturnValue(throwError(() => new Error('409')));

    fixture.componentInstance.aceptarOferta(ot);

    expect(toast.error).toHaveBeenCalledWith('Error de Concurrencia', expect.any(String));
  });

  it('reporta error si no se carga el perfil', () => {
    const tecnicosApi = {
      getTecnicoPorUsuarioId: vi.fn(() => throwError(() => new Error('sin red'))),
      getOfertasParaTecnico: vi.fn(),
      aceptarOferta: vi.fn(),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [OfertasPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
        { provide: TecnicosApi, useValue: tecnicosApi },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(OfertasPage);
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledWith('Error', expect.any(String));
  });
});
