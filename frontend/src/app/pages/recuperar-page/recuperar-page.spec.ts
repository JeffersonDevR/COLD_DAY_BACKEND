import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RecuperarPage } from './recuperar-page';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';

function texto(fixture: ComponentFixture<RecuperarPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function setup(
  solicitar: ReturnType<typeof vi.fn>,
  reset: ReturnType<typeof vi.fn>,
  query: Record<string, string> = {},
  conSesion = false,
) {
  const auth = { isAuthenticated: () => conSesion, logout: vi.fn() };
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [RecuperarPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: UsuariosApi, useValue: { solicitarRecuperacion: solicitar, resetPassword: reset } },
      { provide: ToastService, useValue: toast },
      { provide: AuthService, useValue: auth },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RecuperarPage);
  fixture.detectChanges();
  return { auth, fixture, toast, navigate };
}

describe('RecuperarPage', () => {
  it('solicita el token y pasa al paso 2', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok', tokenSimulado: 'CD-RESET-123456' }));
    const { fixture, toast } = setup(solicitar, vi.fn());

    fixture.componentInstance.solicitarForm.controls.correo.setValue('ana@coldday.com.co');
    fixture.componentInstance.onSolicitarToken();

    expect(solicitar).toHaveBeenCalledWith('ana@coldday.com.co');
    expect(fixture.componentInstance.paso()).toBe(2);
    expect(fixture.componentInstance.tokenSimulado()).toBe('CD-RESET-123456');
    expect(toast.info).toHaveBeenCalled();
  });

  it('no prefigura ni muestra un token fabricado cuando la API no lo entrega', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok' }));
    const { fixture } = setup(solicitar, vi.fn());

    fixture.componentInstance.solicitarForm.controls.correo.setValue('ana@coldday.com.co');
    fixture.componentInstance.onSolicitarToken();
    fixture.detectChanges();

    expect(fixture.componentInstance.tokenSimulado()).toBe('');
    expect(fixture.componentInstance.resetForm.controls.token.value).toBe('');
    expect(texto(fixture)).toContain('Revisa tu correo');
    expect(texto(fixture)).not.toContain('CD-RESET-');
  });

  it('en modo demo rellena el token y solo entonces lo muestra en pantalla', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok', tokenSimulado: 'CD-RESET-123456' }));
    const { fixture } = setup(solicitar, vi.fn());

    fixture.componentInstance.solicitarForm.controls.correo.setValue('ana@coldday.com.co');
    fixture.componentInstance.onSolicitarToken();
    fixture.detectChanges();

    expect(fixture.componentInstance.resetForm.controls.token.value).toBe('CD-RESET-123456');
    expect(texto(fixture)).toContain('CD-RESET-123456');
  });

  it('maneja el error al solicitar', () => {
    const solicitar = vi.fn(() => throwError(() => new Error('sin red')));
    const { fixture, toast } = setup(solicitar, vi.fn());

    fixture.componentInstance.solicitarForm.controls.correo.setValue('ana@coldday.com.co');
    fixture.componentInstance.onSolicitarToken();

    expect(toast.error).toHaveBeenCalled();
    expect(fixture.componentInstance.paso()).toBe(1);
  });

  it('sin token en el enlace abre en el paso 1 con el correo vacío', () => {
    const { fixture } = setup(vi.fn(), vi.fn());

    expect(fixture.componentInstance.paso()).toBe(1);
    expect(fixture.componentInstance.solicitarForm.controls.correo.value).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#correoRec')?.value).toBe('');
  });

  it('con ?token= abre en el paso 2 con el token puesto', () => {
    const reset = vi.fn(() => of({ mensaje: 'Contraseña actualizada' }));
    const { fixture } = setup(vi.fn(), reset, { token: 'abc-123' });
    const html = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.paso()).toBe(2);
    expect(html.querySelector<HTMLInputElement>('#tokenInput')?.value).toBe('abc-123');
    expect(fixture.componentInstance.modoDemo()).toBe(false);
    expect(texto(fixture)).not.toContain('Pégalo');
    expect(texto(fixture)).toContain('Escribe tu nueva contraseña');

    fixture.componentInstance.resetForm.controls.nuevaPassword.setValue('nueva123');
    fixture.componentInstance.onResetPassword();

    expect(reset).toHaveBeenCalledWith('abc-123', 'nueva123');
  });

  it('con ?token= vacío se comporta como sin token', () => {
    const { fixture } = setup(vi.fn(), vi.fn(), { token: '' });

    expect(fixture.componentInstance.paso()).toBe(1);
  });

  it('con sesión abierta, al cambiar la clave cierra la sesión (el token quedó revocado)', () => {
    const reset = vi.fn(() => of({ mensaje: 'Contraseña actualizada' }));
    const { fixture, auth } = setup(vi.fn(), reset, { token: 'abc-123' }, true);

    fixture.componentInstance.resetForm.controls.nuevaPassword.setValue('nueva123');
    fixture.componentInstance.onResetPassword();

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('no envía si el correo es inválido', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok' }));
    const { fixture } = setup(solicitar, vi.fn());
    fixture.componentInstance.solicitarForm.controls.correo.setValue('');

    fixture.componentInstance.onSolicitarToken();

    expect(solicitar).not.toHaveBeenCalled();
  });

  it('restablece la contraseña y navega al login', () => {
    const reset = vi.fn(() => of({ mensaje: 'Contraseña actualizada' }));
    const { fixture, toast, navigate } = setup(vi.fn(), reset);
    fixture.componentInstance.resetForm.setValue({ token: 'CD-RESET-1', nuevaPassword: 'nueva123' });

    fixture.componentInstance.onResetPassword();

    expect(reset).toHaveBeenCalledWith('CD-RESET-1', 'nueva123');
    expect(toast.success).toHaveBeenCalledWith('¡Listo!', 'Contraseña actualizada');
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('no restablece con el formulario inválido', () => {
    const reset = vi.fn(() => of({ mensaje: 'ok' }));
    const { fixture } = setup(vi.fn(), reset);

    fixture.componentInstance.onResetPassword();

    expect(reset).not.toHaveBeenCalled();
  });

  it('maneja el error al restablecer', () => {
    const reset = vi.fn(() => throwError(() => new Error('token vencido')));
    const { fixture, toast } = setup(vi.fn(), reset);
    fixture.componentInstance.resetForm.setValue({ token: 'x', nuevaPassword: 'nueva123' });

    fixture.componentInstance.onResetPassword();

    expect(toast.error).toHaveBeenCalled();
  });
});
