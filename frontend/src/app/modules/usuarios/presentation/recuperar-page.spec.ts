import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RecuperarPage } from './recuperar-page';
import { UsuariosApi } from '../infrastructure/usuarios-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';

function setup(solicitar: ReturnType<typeof vi.fn>, reset: ReturnType<typeof vi.fn>) {
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [RecuperarPage],
    providers: [
      provideRouter([]),
      { provide: UsuariosApi, useValue: { solicitarRecuperacion: solicitar, resetPassword: reset } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RecuperarPage);
  fixture.detectChanges();
  return { fixture, toast, navigate };
}

describe('RecuperarPage', () => {
  it('solicita el token y pasa al paso 2', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok', tokenSimulado: 'CD-RESET-123456' }));
    const { fixture, toast } = setup(solicitar, vi.fn());

    fixture.componentInstance.onSolicitarToken();

    expect(solicitar).toHaveBeenCalledWith('maria.gomez@gmail.com');
    expect(fixture.componentInstance.paso()).toBe(2);
    expect(fixture.componentInstance.tokenSimulado()).toBe('CD-RESET-123456');
    expect(toast.info).toHaveBeenCalled();
  });

  it('usa un token por defecto si la API no lo entrega', () => {
    const solicitar = vi.fn(() => of({ mensaje: 'ok' }));
    const { fixture } = setup(solicitar, vi.fn());

    fixture.componentInstance.onSolicitarToken();

    expect(fixture.componentInstance.tokenSimulado()).toContain('CD-RESET-');
  });

  it('maneja el error al solicitar', () => {
    const solicitar = vi.fn(() => throwError(() => new Error('sin red')));
    const { fixture, toast } = setup(solicitar, vi.fn());

    fixture.componentInstance.onSolicitarToken();

    expect(toast.error).toHaveBeenCalled();
    expect(fixture.componentInstance.paso()).toBe(1);
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
