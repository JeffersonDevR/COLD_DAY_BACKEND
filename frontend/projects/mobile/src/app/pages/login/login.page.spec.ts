import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Router } from '@angular/router';
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
  enviar(): void;
}

function setup(login: Observable<TokenResponse>, home: string | null = '/cliente/panel') {
  const usuariosApi = { login: vi.fn(() => login) };
  const auth = { establecerSesionDesdeToken: vi.fn() };
  const modos = { homeActual: () => home };
  const toast = { error: vi.fn() };
  const router = { navigateByUrl: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      { provide: UsuariosApi, useValue: usuariosApi },
      { provide: AuthService, useValue: auth },
      { provide: ModoService, useValue: modos },
      { provide: MobileToastService, useValue: toast },
      { provide: Router, useValue: router },
    ],
  });

  const fixture: ComponentFixture<LoginPage> = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  const page = fixture.componentInstance as unknown as LoginPageInternals;
  return { fixture, page, usuariosApi, auth, toast, router };
}

function completar(page: LoginPageInternals, correo = 'persona@coldday.co', password = 'secreto123') {
  page.loginForm.setValue({ correo, password });
}

function botonEntrar(fixture: ComponentFixture<LoginPage>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('[data-testid="entrar"]') as HTMLButtonElement;
}

describe('LoginPage móvil', () => {
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
    const { fixture, page, usuariosApi, auth, router } = setup(of(respuesta));
    completar(page, 'persona@coldday.co');
    fixture.detectChanges();

    page.enviar();

    expect(usuariosApi.login).toHaveBeenCalledWith('persona@coldday.co', 'secreto123');
    expect(auth.establecerSesionDesdeToken).toHaveBeenCalledWith(
      respuesta,
      'persona@coldday.co',
      undefined,
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cliente/panel');
    expect(page.loading()).toBe(false);
  });

  it('una cuenta sin modo móvil aterriza en "usá la web"', () => {
    const { page, router } = setup(of(respuesta), null);
    completar(page);

    page.enviar();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/solo-web');
  });

  it('muestra por toast el 401 del login y no navega', () => {
    const { page, toast, router } = setup(
      throwError(() => new ApiHttpError('Credenciales inválidas', 401)),
    );
    completar(page);

    page.enviar();

    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos iniciar sesión',
      expect.stringContaining('incorrectos'),
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(page.loading()).toBe(false);
  });
});
