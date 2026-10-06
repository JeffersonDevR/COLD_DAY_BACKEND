import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegistroPage } from './registro-page';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ClientesApi } from '../../modules/clientes/infrastructure/clientes-api';
import { TecnicosApi } from '../../modules/tecnicos/infrastructure/tecnicos-api';
import { ProveedoresApi } from '../../modules/proveedores/infrastructure/proveedores-api';
import { ProveedorRegistroService } from '../../modules/proveedores/infrastructure/proveedor-registro.service';
import { ApiConfig } from '../../core/shared/infrastructure/api/api.config';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { UsuarioResponse } from '../../core/models/common.models';

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
  proveedoresApi: { registrar: ReturnType<typeof vi.fn> };
  proveedorRegistro: { guardar: ReturnType<typeof vi.fn> };
  auth: { establecerSesionDesdeToken: ReturnType<typeof vi.fn>; getDashboardRouteForRole: ReturnType<typeof vi.fn>; setCurrentUser: ReturnType<typeof vi.fn> };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function setup(useMocks = false): { fixture: ComponentFixture<RegistroPage>; mocks: Mocks; navigate: ReturnType<typeof vi.fn> } {
  const mocks: Mocks = {
    usuariosApi: { registro: vi.fn(() => of(usuario)), login: vi.fn(() => of({ token: 't', expiracion: 'e', rol: 'CLIENTE' })) },
    clientesApi: { registrarCliente: vi.fn(() => of({})) },
    tecnicosApi: { registrar: vi.fn(() => of({})) },
    proveedoresApi: {
      registrar: vi.fn(() => of({
        id: 'PROV-1',
        usuarioId: 42,
        razonSocial: 'Suministros del Norte S.A.S.',
        nit: '900123456-1',
        activo: true,
        estadoValidacion: 'PENDIENTE',
      })),
    },
    proveedorRegistro: { guardar: vi.fn() },
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
      { provide: ProveedoresApi, useValue: mocks.proveedoresApi },
      { provide: ProveedorRegistroService, useValue: mocks.proveedorRegistro },
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
    razonSocial: 'Suministros del Norte S.A.S.',
    nit: '900123456-1',
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

  describe('alta de proveedor', () => {
    it('exige razón social y NIT antes de llamar al backend', () => {
      const { fixture, mocks } = setup();
      llenarFormulario(fixture);
      const page = fixture.componentInstance;
      page.selectedRol.set('PROVEEDOR');
      page.registroForm.controls.razonSocial.setValue('  ');
      page.registroForm.controls.nit.setValue('');

      page.onSubmit();

      expect(mocks.toast.error).toHaveBeenCalledWith('Faltan datos comerciales', expect.any(String));
      expect(mocks.proveedoresApi.registrar).not.toHaveBeenCalled();
    });

    it('crea el proveedor por POST /api/proveedores sin mandarle un rol y luego inicia sesión', () => {
      const { fixture, mocks, navigate } = setup();
      llenarFormulario(fixture);
      fixture.componentInstance.selectedRol.set('PROVEEDOR');

      fixture.componentInstance.onSubmit();

      expect(mocks.proveedoresApi.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          correo: 'nuevo@coldday.co',
          razonSocial: 'Suministros del Norte S.A.S.',
          nit: '900123456-1',
          aceptaHabeasData: true,
        }),
      );
      // El rol no es un dato de entrada: lo aplica el servidor.
      expect(mocks.proveedoresApi.registrar.mock.calls[0][0]).not.toHaveProperty('rol');
      expect(mocks.usuariosApi.login).toHaveBeenCalledWith('nuevo@coldday.co', 'secreta1');
      expect(mocks.toast.success).toHaveBeenCalled();
      void navigate;
    });

    it('recuerda el estado PENDIENTE del alta para la pantalla de expediente', () => {
      const { fixture, mocks } = setup();
      llenarFormulario(fixture);
      fixture.componentInstance.selectedRol.set('PROVEEDOR');

      fixture.componentInstance.onSubmit();

      expect(mocks.proveedorRegistro.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PROV-1', estadoValidacion: 'PENDIENTE' }),
      );
    });

    it('aterriza en el expediente y no en el panel de solicitudes, que respondería 403', () => {
      const { fixture, mocks, navigate } = setup();
      mocks.auth.establecerSesionDesdeToken.mockReturnValue({ ...usuario, rol: 'PROVEEDOR' });
      llenarFormulario(fixture);
      fixture.componentInstance.selectedRol.set('PROVEEDOR');

      fixture.componentInstance.onSubmit();

      expect(navigate).toHaveBeenCalledWith(['/proveedor/documentos']);
      expect(mocks.clientesApi.registrarCliente).not.toHaveBeenCalled();
      expect(mocks.usuariosApi.registro).not.toHaveBeenCalled();
    });

    it('propaga el error del alta del proveedor', () => {
      const { fixture, mocks } = setup();
      mocks.proveedoresApi.registrar.mockReturnValue(throwError(() => new Error('NIT duplicado')));
      llenarFormulario(fixture);
      fixture.componentInstance.selectedRol.set('PROVEEDOR');

      fixture.componentInstance.onSubmit();

      expect(mocks.toast.error).toHaveBeenCalledWith('Error al registrar', 'NIT duplicado');
      expect(mocks.usuariosApi.login).not.toHaveBeenCalled();
    });
  });
});
