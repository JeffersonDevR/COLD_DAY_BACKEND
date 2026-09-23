import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login-page';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { ThemeService } from '../../../core/shared/presentation/theme.service';
import { UsuarioResponse } from '../../../core/shared/domain/models/common.models';

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'María Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function setup(login: ReturnType<typeof vi.fn>) {
  const auth = {
    establecerSesionDesdeToken: vi.fn(() => usuario),
    getDashboardRouteForRole: vi.fn(() => '/panel'),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  const theme = { isDark: () => false, toggleTheme: vi.fn() };

  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      { provide: UsuariosApi, useValue: { login } },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
      { provide: ThemeService, useValue: theme },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  return { fixture, auth, toast, navigate };
}

describe('LoginPage', () => {
  it('inicia sesión con el formulario válido', () => {
    const login = vi.fn(() => of({ token: 't', expiracion: 'e', rol: 'CLIENTE', usuario }));
    const { fixture, auth, toast, navigate } = setup(login);

    fixture.componentInstance.onSubmit();

    expect(login).toHaveBeenCalledWith('maria.gomez@gmail.com', 'demo1234');
    expect(auth.establecerSesionDesdeToken).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/panel']);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('no llama a la API si el formulario es inválido', () => {
    const login = vi.fn(() => of({ token: 't', expiracion: 'e', rol: 'CLIENTE' }));
    const { fixture } = setup(login);
    fixture.componentInstance.loginForm.controls.correo.setValue('');

    fixture.componentInstance.onSubmit();

    expect(login).not.toHaveBeenCalled();
  });

  it('muestra el error de autenticación', () => {
    const login = vi.fn(() => throwError(() => new Error('Credenciales inválidas')));
    const { fixture, toast } = setup(login);

    fixture.componentInstance.onSubmit();

    expect(toast.error).toHaveBeenCalledWith('Error de autenticación', 'Credenciales inválidas');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('quickLogin usa demo1234 y navega al panel del rol', () => {
    const login = vi.fn(() => of({ token: 't', expiracion: 'e', rol: 'CLIENTE', usuario }));
    const { fixture, navigate, toast } = setup(login);

    fixture.componentInstance.quickLogin('maria.gomez@gmail.com', 'CLIENTE');

    expect(login).toHaveBeenCalledWith('maria.gomez@gmail.com', 'demo1234');
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('quickLogin maneja el error', () => {
    const login = vi.fn(() => throwError(() => new Error('sin red')));
    const { fixture, toast } = setup(login);

    fixture.componentInstance.quickLogin('x@x.co', 'TECNICO');

    expect(toast.error).toHaveBeenCalledWith('Acceso Demo', 'sin red');
  });
});
