import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminCuentasPage } from './admin-cuentas-page';
import { CuentaInterna, CuentasApi } from '../../core/service/cuentas-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';

const cuenta: CuentaInterna = {
  id: 7,
  nombre: 'Ana Martínez',
  correo: 'ana@example.com',
  rol: 'CONTABLE',
  activa: true,
};

function setup(opciones: { cuentas?: CuentaInterna[]; listar?: ReturnType<typeof vi.fn>; crearError?: unknown } = {}) {
  const api = {
    listar: opciones.listar ?? vi.fn(() => of(opciones.cuentas ?? [cuenta])),
    crear: vi.fn(() => (opciones.crearError ? throwError(() => opciones.crearError) : of(cuenta))),
    cambiarEstado: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [AdminCuentasPage],
    providers: [
      { provide: CuentasApi, useValue: api },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture: ComponentFixture<AdminCuentasPage> = TestBed.createComponent(AdminCuentasPage);
  fixture.detectChanges();
  const texto = () => fixture.nativeElement.textContent as string;
  const boton = (nombre: string) =>
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement;
  const pulsar = (nombre: string) => {
    boton(nombre).click();
    fixture.detectChanges();
  };
  return { fixture, api, toast, texto, boton, pulsar, pagina: fixture.componentInstance };
}

describe('AdminCuentasPage', () => {
  it('lista las cuentas con su rol y estado', () => {
    const { texto } = setup();

    expect(texto()).toContain('Ana Martínez');
    expect(texto()).toContain('ana@example.com');
    expect(texto()).toContain('Contable');
    expect(texto()).toContain('Activa');
  });

  it('solo ofrece los roles que se pueden crear', () => {
    const { fixture } = setup();
    const opciones = Array.from(
      fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>,
    ).map((o) => o.textContent?.trim());

    expect(opciones).toEqual(['Contable', 'Recursos Humanos']);
  });

  it('no envía con campos vacíos o correo inválido', () => {
    const { api, pagina } = setup();

    pagina.crear();
    pagina.form.patchValue({ nombre: 'Laura', correo: 'no-es-correo' });
    pagina.crear();

    expect(api.crear).not.toHaveBeenCalled();
  });

  it('al crear avisa a qué correo se invitó, sin prometer que llegó, y limpia el formulario', () => {
    const { api, toast, pagina } = setup();
    pagina.form.setValue({ nombre: 'Laura', correo: 'laura@example.com', rol: 'RECURSOS_HUMANOS' });

    pagina.crear();

    expect(api.crear).toHaveBeenCalledWith({ nombre: 'Laura', correo: 'laura@example.com', rol: 'RECURSOS_HUMANOS' });
    expect(toast.success).toHaveBeenCalledWith(
      'Cuenta creada',
      'Enviamos la invitación a laura@example.com. Si no llega, la persona puede usar «Recuperar contraseña».',
    );
    expect(pagina.form.getRawValue().correo).toBe('');
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('con un correo repetido lo dice y conserva lo escrito', () => {
    const { toast, pagina } = setup({ crearError: new ApiHttpError('duplicado', 409) });
    pagina.form.setValue({ nombre: 'Laura', correo: 'ana@example.com', rol: 'CONTABLE' });

    pagina.crear();

    expect(toast.error).toHaveBeenCalledWith('No se pudo crear la cuenta', 'Ya existe una cuenta con ese correo.');
    expect(pagina.form.getRawValue().correo).toBe('ana@example.com');
  });

  it('desactivar pide confirmación antes de llamar al servidor', () => {
    const { api, pulsar } = setup();

    pulsar('Desactivar');
    expect(api.cambiarEstado).not.toHaveBeenCalled();

    pulsar('Sí, desactivar');
    expect(api.cambiarEstado).toHaveBeenCalledWith(7, false);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('reactiva una cuenta desactivada', () => {
    const { api, pulsar } = setup({ cuentas: [{ ...cuenta, activa: false }] });

    pulsar('Reactivar');

    expect(api.cambiarEstado).toHaveBeenCalledWith(7, true);
  });

  it('avisa si la lista no carga y deja reintentar', () => {
    const listar = vi.fn().mockReturnValueOnce(throwError(() => new Error('sin red'))).mockReturnValue(of([cuenta]));
    const { texto, pulsar } = setup({ listar });

    expect(texto()).toContain('No pudimos cargar las cuentas.');
    pulsar('Reintentar');
    expect(texto()).toContain('Ana Martínez');
  });
});
