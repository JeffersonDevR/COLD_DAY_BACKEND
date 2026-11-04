import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter, Router } from '@angular/router';
import { WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import { TokenResponse } from '@core/models/common.models';
import { UsuariosApi } from '@core/service/usuarios-api';
import { MobileToastService } from '../../core/toast.service';
import { ModoService } from '../../modo/modo.service';
import { LoginPage } from './login.page';

const respuesta: TokenResponse = { token: 'jwt', expiracion: '', rol: 'CLIENTE' };

/** Vista del componente con lo que ejercitan los tests (miembros protected). */
interface LoginPageInternals {
  readonly loginForm: FormGroup;
  readonly loading: WritableSignal<boolean>;
  readonly verPassword: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  enviar(): void;
}

function setup(login: Observable<TokenResponse>, home: string | null = '/cliente/panel') {
  const usuariosApi = { login: vi.fn(() => login) };
  const auth = { establecerSesionDesdeToken: vi.fn() };
  const modos = { homeActual: () => home };
  const toast = { error: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: UsuariosApi, useValue: usuariosApi },
      { provide: AuthService, useValue: auth },
      { provide: ModoService, useValue: modos },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture: ComponentFixture<LoginPage> = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  const page = fixture.componentInstance as unknown as LoginPageInternals;
  return { fixture, page, usuariosApi, auth, toast, navigate };
}

function completar(page: LoginPageInternals, correo = 'persona@coldday.co', password = 'secreto123') {
  page.loginForm.setValue({ correo, password });
}

function botonEntrar(fixture: ComponentFixture<LoginPage>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('[data-testid="entrar"]') as HTMLButtonElement;
}

describe('LoginPage móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('con el formulario vacío el botón está deshabilitado y no llama al backend', () => {
    const { fixture, page, usuariosApi } = setup(of(respuesta));

    expect(page.loginForm.invalid).toBe(true);
    expect(botonEntrar(fixture).disabled).toBe(true);

    page.enviar();

    expect(usuariosApi.login).not.toHaveBeenCalled();
  });

  it('se deshabilita mientras el login está en vuelo', () => {
    const { fixture, page } = setup(of(respuesta));
    completar(page);
    fixture.detectChanges();

    page.loading.set(true);
    fixture.detectChanges();

    expect(botonEntrar(fixture).disabled).toBe(true);

    page.enviar();
    // Sigue en vuelo: no dispara un segundo login.
    expect(page.loading()).toBe(true);
  });

  it('un login exitoso establece la sesión y navega al home del modo', () => {
    const { page, usuariosApi, auth, navigate } = setup(of(respuesta));
    completar(page, 'persona@coldday.co');

    page.enviar();

    expect(usuariosApi.login).toHaveBeenCalledWith('persona@coldday.co', 'secreto123');
    expect(auth.establecerSesionDesdeToken).toHaveBeenCalledWith(
      respuesta,
      'persona@coldday.co',
      undefined,
    );
    expect(navigate).toHaveBeenCalledWith('/cliente/panel');
    expect(page.loading()).toBe(false);
    expect(page.error()).toBeNull();
  });

  it('una cuenta sin modo móvil aterriza en "usá la web"', () => {
    const { page, navigate } = setup(of(respuesta), null);
    completar(page);

    page.enviar();

    expect(navigate).toHaveBeenCalledWith('/solo-web');
  });

  it('muestra por toast y inline el 401 del login y no navega', () => {
    const { fixture, page, toast, navigate } = setup(
      throwError(() => new ApiHttpError('Credenciales inválidas', 401)),
    );
    completar(page);

    page.enviar();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos iniciar sesión',
      expect.stringContaining('Correo o contraseña incorrectos'),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(page.loading()).toBe(false);

    const inline = fixture.nativeElement.querySelector('[data-testid="error-login"]');
    expect(inline.textContent).toContain('Correo o contraseña incorrectos');
  });

  it('no repite el mensaje crudo del backend en el toast', () => {
    const { page, toast } = setup(
      throwError(() => new ApiHttpError('Bad credentials para usuario 42', 401)),
    );
    completar(page);

    page.enviar();

    const [, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(mensaje).not.toContain('Bad credentials');
    expect(mensaje).not.toContain('42');
  });

  it('el toggle de contraseña alterna el tipo del campo', () => {
    const { fixture, page } = setup(of(respuesta));
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="toggle-password"]',
    ) as HTMLButtonElement;

    expect(page.verPassword()).toBe(false);
    toggle.click();
    expect(page.verPassword()).toBe(true);
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toContain('Ocultar');
    toggle.click();
    expect(page.verPassword()).toBe(false);
  });

  it('ofrece el enlace al registro', () => {
    const { fixture } = setup(of(respuesta));
    const enlace = fixture.nativeElement.querySelector('[data-testid="ir-registro"]');

    expect(enlace.getAttribute('href')).toBe('/registro');
    expect(fixture.nativeElement.textContent).toContain('¿No tenés cuenta?');
  });
});
