import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegistroPage } from './registro-page';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ClientesApi } from '../../clientes/infrastructure/clientes-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { UsuarioResponse } from '../../../core/shared/domain/models/common.models';

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'Nuevo Usuario',
  correo: 'nuevo@coldday.co',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

interface Mocks {
  usuariosApi: { registro: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
  clientesApi: { registrarCliente: ReturnType<typeof vi.fn> };
  tecnicosApi: { registrar: ReturnType<typeof vi.fn> };
  auth: { establecerSesionDesdeToken: ReturnType<typeof vi.fn>; getDashboardRouteForRole: ReturnType<typeof vi.fn>; setCurrentUser: ReturnType<typeof vi.fn> };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function setup(useMocks = false): { fixture: ComponentFixture<RegistroPage>; mocks: Mocks; navigate: ReturnType<typeof vi.fn> } {
  const mocks: Mocks = {
    usuariosApi: { registro: vi.fn(() => of(usuario)), login: vi.fn(() => of({ token: 't', expiracion: 'e', rol: 'CLIENTE' })) },
    clientesApi: { registrarCliente: vi.fn(() => of({})) },
    tecnicosApi: { registrar: vi.fn(() => of({})) },
    auth: {
      establecerSesionDesdeToken: vi.fn(() => usuario),
      getDashboardRouteForRole: vi.fn(() => '/panel'),
      setCurrentUser: vi.fn(),
    },
    toast: { success: vi.fn(), error: vi.fn() },
  };

  TestBed.configureTestingModule({
    imports: [RegistroPage],
    providers: [
      provideRouter([]),
      { provide: UsuariosApi, useValue: mocks.usuariosApi },
      { provide: ClientesApi, useValue: mocks.clientesApi },
      { provide: TecnicosApi, useValue: mocks.tecnicosApi },
      { provide: ApiConfig, useValue: { useMocks: () => useMocks } },
      { provide: AuthService, useValue: mocks.auth },
      { provide: ToastService, useValue: mocks.toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RegistroPage);
  fixture.detectChanges();
  return { fixture, mocks, navigate };
}

function llenarFormulario(fixture: ComponentFixture<RegistroPage>): void {
  fixture.componentInstance.registroForm.setValue({
    nombre: 'Nuevo Usuario',
    correo: 'nuevo@coldday.co',
    telefono: '3123456789',
    password: 'secreta1',
    numeroIdentificacion: '1098765001',
    aceptaHabeasData: true,
  });
}

describe('RegistroPage', () => {
  it('alterna especialidades', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance;
    expect(page.hasEspecialidad('REFRIGERACION')).toBe(true);
    page.toggleEspecialidad('REFRIGERACION');
    expect(page.hasEspecialidad('REFRIGERACION')).toBe(false);
    page.toggleEspecialidad('ELECTRICIDAD');
    expect(page.hasEspecialidad('ELECTRICIDAD')).toBe(true);
  });

  it('no envía si el formulario es inválido', () => {
    const { fixture, mocks } = setup();
    fixture.componentInstance.onSubmit();
    expect(mocks.clientesApi.registrarCliente).not.toHaveBeenCalled();
  });

  it('exige cédula cuando el rol es técnico', () => {
    const { fixture, mocks } = setup();
    llenarFormulario(fixture);
    fixture.componentInstance.selectedRol.set('TECNICO');
    fixture.componentInstance.registroForm.controls.numeroIdentificacion.setValue('');

    fixture.componentInstance.onSubmit();

    expect(mocks.toast.error).toHaveBeenCalledWith('Falta la cédula', expect.any(String));
    expect(mocks.tecnicosApi.registrar).not.toHaveBeenCalled();
  });

  it('registra un cliente real y establece sesión', () => {
    const { fixture, mocks, navigate } = setup();
    llenarFormulario(fixture);

    fixture.componentInstance.onSubmit();

    expect(mocks.clientesApi.registrarCliente).toHaveBeenCalled();
    expect(mocks.usuariosApi.login).toHaveBeenCalledWith('nuevo@coldday.co', 'secreta1');
    expect(mocks.auth.establecerSesionDesdeToken).toHaveBeenCalled();
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('registra un técnico real con sus especialidades', () => {
    const { fixture, mocks } = setup();
    llenarFormulario(fixture);
    fixture.componentInstance.selectedRol.set('TECNICO');

    fixture.componentInstance.onSubmit();

    expect(mocks.tecnicosApi.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ correo: 'nuevo@coldday.co', numeroIdentificacion: '1098765001' }),
    );
    expect(mocks.usuariosApi.login).toHaveBeenCalled();
  });

  it('en modo mock usa el alta en memoria', () => {
    const { fixture, mocks } = setup(true);
    llenarFormulario(fixture);

    fixture.componentInstance.onSubmit();

    expect(mocks.usuariosApi.registro).toHaveBeenCalled();
    expect(mocks.auth.setCurrentUser).toHaveBeenCalled();
  });

  it('muestra error si falla el alta', () => {
    const { fixture, mocks } = setup();
    mocks.clientesApi.registrarCliente.mockReturnValue(throwError(() => new Error('correo duplicado')));
    llenarFormulario(fixture);

    fixture.componentInstance.onSubmit();

    expect(mocks.toast.error).toHaveBeenCalledWith('Error al registrar', 'correo duplicado');
  });
});
