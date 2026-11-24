import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter, Router } from '@angular/router';
import { WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import {
  ProveedorResponse,
  TokenResponse,
} from '@core/models/common.models';
import { ClientesApi } from '@core/service/clientes-api';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { UsuariosApi } from '@core/service/usuarios-api';
import { MobileToastService } from '../../core/toast.service';
import { ModoService } from '../../modo/modo.service';
import { RegistroPage } from './registro.page';

const respuesta: TokenResponse = { token: 'jwt', expiracion: '', rol: 'CLIENTE' };

const proveedorCreado: ProveedorResponse = {
  id: 'PROV-1',
  usuarioId: 12,
  razonSocial: 'Suministros del Norte S.A.S.',
  nit: '900123456-1',
  telefono: '3105550001',
  activo: true,
  estadoValidacion: 'PENDIENTE',
};

interface RegistroPageInternals {
  readonly registroForm: FormGroup;
  readonly loading: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  readonly rol: WritableSignal<string>;
  enviar(): void;
  cambiarRol(rol: 'CLIENTE' | 'TECNICO' | 'PROVEEDOR'): void;
  alternarPassword(): void;
  readonly verPassword: () => boolean;
}

function setup(opts: {
  home?: string | null;
  cliente?: Observable<unknown>;
  tecnico?: Observable<unknown>;
  proveedor?: Observable<ProveedorResponse>;
  login?: Observable<TokenResponse>;
} = {}) {
  const clientesApi = { registrarCliente: vi.fn(() => opts.cliente ?? of({})) };
  const tecnicosApi = { registrar: vi.fn(() => opts.tecnico ?? of({})) };
  const proveedoresApi = {
    registrar: vi.fn(() => opts.proveedor ?? of(proveedorCreado)),
  };
  const usuariosApi = { login: vi.fn(() => opts.login ?? of(respuesta)) };
  const auth = { establecerSesionDesdeToken: vi.fn() };
  const proveedorRegistro = { guardar: vi.fn() };
  const modos = { homeActual: () => (opts.home === undefined ? '/cliente/panel' : opts.home) };
  const toast = { error: vi.fn(), success: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: UsuariosApi, useValue: usuariosApi },
      { provide: ClientesApi, useValue: clientesApi },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ProveedoresApi, useValue: proveedoresApi },
      { provide: AuthService, useValue: auth },
      { provide: ProveedorRegistroService, useValue: proveedorRegistro },
      { provide: ModoService, useValue: modos },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture: ComponentFixture<RegistroPage> = TestBed.createComponent(RegistroPage);
  fixture.detectChanges();
  const page = fixture.componentInstance as unknown as RegistroPageInternals;

  return {
    fixture,
    page,
    clientesApi,
    tecnicosApi,
    proveedoresApi,
    usuariosApi,
    auth,
    proveedorRegistro,
    toast,
    navigate,
  };
}

const base = {
  nombre: 'Ana Pérez',
  correo: 'ana@coldday.co',
  telefono: '3001234567',
  password: 'secreto1',
  aceptaHabeasData: true,
};

function llenarCliente(page: RegistroPageInternals, extra: Record<string, unknown> = {}) {
  page.registroForm.patchValue({ ...base, ...extra });
}

function llenarTecnico(page: RegistroPageInternals) {
  page.cambiarRol('TECNICO');
  page.registroForm.patchValue({ ...base, correo: 'tecnico@coldday.co' });
}

function llenarProveedor(page: RegistroPageInternals) {
  page.cambiarRol('PROVEEDOR');
  page.registroForm.patchValue({
    ...base,
    nombre: 'Juan Pérez',
    correo: 'proveedor@coldday.co',
  });
}

function campo(fixture: ComponentFixture<RegistroPage>, testId: string): Element | null {
  return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
}

describe('RegistroPage móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('arranca como cliente y no pide datos de servicio en ningún rol', () => {
    const { fixture, page } = setup();

    expect(page.rol()).toBe('CLIENTE');
    for (const testId of [
      'campos-cliente',
      'campos-tecnico',
      'campos-proveedor',
      'calle',
      'ciudad',
      'numero-identificacion',
      'nit',
    ]) {
      expect(campo(fixture, testId)).toBeNull();
    }
  });

  it('el selector de rol cambia de rol sin agregar campos', () => {
    const { fixture, page } = setup();

    (campo(fixture, 'rol-tecnico') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.rol()).toBe('TECNICO');
    expect(campo(fixture, 'campos-tecnico')).toBeNull();

    (campo(fixture, 'rol-proveedor') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.rol()).toBe('PROVEEDOR');
    expect(campo(fixture, 'campos-proveedor')).toBeNull();
  });

  it('con campos vacíos no llama al backend y muestra los errores de campo', () => {
    const { fixture, page, clientesApi } = setup();

    page.enviar();
    fixture.detectChanges();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
    expect(page.error()).toBeNull();
    expect(campo(fixture, 'error-nombre')?.textContent).toContain('Ingresa tu nombre completo');
    expect(campo(fixture, 'error-habeas')?.textContent).toContain('tratamiento de datos');
  });

  it('exige contraseña de 8 caracteres, como el backend', () => {
    const { page, clientesApi } = setup();
    llenarCliente(page, { password: 'abc1234' });

    page.enviar();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
  });

  it('cliente: crea la cuenta solo con los datos de acceso y adopta la sesión', () => {
    const { page, clientesApi, usuariosApi, auth, toast, navigate } = setup();
    llenarCliente(page);

    page.enviar();

    expect(clientesApi.registrarCliente).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      correo: 'ana@coldday.co',
      password: 'secreto1',
      telefono: '3001234567',
      aceptaHabeasData: true,
    });
    expect(usuariosApi.login).toHaveBeenCalledWith('ana@coldday.co', 'secreto1');
    expect(auth.establecerSesionDesdeToken).toHaveBeenCalledWith(respuesta, 'ana@coldday.co');
    expect(toast.success).toHaveBeenCalledWith('Cuenta creada', expect.any(String));
    expect(navigate).toHaveBeenCalledWith('/cliente/panel');
    expect(page.loading()).toBe(false);
  });

  it('técnico: se registra sin cédula ni especialidades', () => {
    const { page, tecnicosApi, navigate } = setup({ home: '/tecnico/radar' });
    llenarTecnico(page);

    page.enviar();

    expect(tecnicosApi.registrar).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      correo: 'tecnico@coldday.co',
      password: 'secreto1',
      telefono: '3001234567',
      aceptaHabeasData: true,
    });
    expect(navigate).toHaveBeenCalledWith('/tecnico/radar');
  });

  it('proveedor: se registra sin razón social ni NIT y aterriza en su expediente', () => {
    const { page, proveedoresApi, proveedorRegistro, navigate } = setup({
      home: '/proveedor/insumos',
    });
    llenarProveedor(page);

    page.enviar();

    expect(proveedoresApi.registrar).toHaveBeenCalledWith({
      nombre: 'Juan Pérez',
      correo: 'proveedor@coldday.co',
      password: 'secreto1',
      telefono: '3001234567',
      aceptaHabeasData: true,
    });
    expect(proveedorRegistro.guardar).toHaveBeenCalledWith({
      id: 'PROV-1',
      usuarioId: 12,
      razonSocial: 'Suministros del Norte S.A.S.',
      nit: '900123456-1',
      estadoValidacion: 'PENDIENTE',
    });
    expect(navigate).toHaveBeenCalledWith('/proveedor/documentos');
  });

  it('el 409 de cliente nombra solo el correo', () => {
    const { page, toast } = setup({
      cliente: throwError(() => new ApiHttpError('Conflict', 409)),
    });
    llenarCliente(page);

    page.enviar();

    const [, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(mensaje).toContain('Ya existe una cuenta con ese correo');
    expect(mensaje).not.toContain('identificación');
  });

  it('el 409 de técnico no afirma que el correo fue la causa', () => {
    const { page, toast } = setup({
      tecnico: throwError(() => new ApiHttpError('Conflict', 409)),
    });
    llenarTecnico(page);

    page.enviar();

    const [, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(mensaje).toContain('número de identificación');
    expect(mensaje).toContain('correo');
  });

  it('el 409 de proveedor nombra el NIT', () => {
    const { page, toast } = setup({
      proveedor: throwError(() => new ApiHttpError('Conflict', 409)),
    });
    llenarProveedor(page);

    page.enviar();

    const [, mensaje] = toast.error.mock.calls[0] as [string, string];
    expect(mensaje).toContain('NIT');
  });

  it('si la cuenta se creó pero el login falla, manda al login con aviso de éxito', () => {
    const { page, toast, navigate, auth } = setup({
      login: throwError(() => new ApiHttpError('Sin red', 0)),
    });
    llenarCliente(page);

    page.enviar();

    expect(auth.establecerSesionDesdeToken).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Cuenta creada', expect.any(String));
    expect(toast.error).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(page.loading()).toBe(false);
  });

  it('sin aceptar Habeas Data no se crea la cuenta', () => {
    const { page, clientesApi } = setup();
    llenarCliente(page, { aceptaHabeasData: false });

    page.enviar();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
  });

  it('no pide repetir la contraseña', () => {
    const { fixture, page } = setup();

    expect(campo(fixture, 'confirmacion')).toBeNull();
    expect('confirmacion' in page.registroForm.controls).toBe(false);
  });

  it('el ojo vive dentro del campo de contraseña y cambia su tipo', () => {
    const { fixture, page } = setup();
    const toggle = campo(fixture, 'toggle-password') as HTMLButtonElement;

    expect(toggle.closest('ion-item')).toBe(campo(fixture, 'password')!.closest('ion-item'));
    expect(toggle.getAttribute('aria-label')).toContain('Mostrar');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toContain('Ocultar');
    expect(page.verPassword()).toBe(true);
  });

  it('el ojo no envía el formulario', () => {
    const { fixture, page, clientesApi } = setup();
    llenarCliente(page);

    (campo(fixture, 'toggle-password') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
  });

  it('el copy del registro está en tuteo', () => {
    const { fixture, page } = setup();

    page.enviar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toMatch(
      /(Ingresá|Elegí|Repetí|Debés|Creá|tenés)/,
    );
  });

  it('ofrece el enlace al login', () => {
    const { fixture } = setup();

    expect(campo(fixture, 'ir-login')?.getAttribute('href')).toBe('/login');
  });

  it('el selector de rol es un campo dentro del formulario, no un menú aparte', () => {
    const { fixture } = setup();

    for (const rol of ['cliente', 'tecnico', 'proveedor']) {
      const chip = campo(fixture, `rol-${rol}`) as HTMLButtonElement;
      expect(chip.tagName).toBe('BUTTON');
      expect(chip.closest('form')).not.toBeNull();
    }
    expect(fixture.nativeElement.querySelector('.cd-segment')).toBeNull();
  });

  it('el selector está rotulado «Soy…» y expone el rol activo con aria-pressed', () => {
    const { fixture, page } = setup();
    const grupo = fixture.nativeElement.querySelector('[role="group"]') as HTMLElement;

    expect(grupo.textContent).toContain('Soy');
    expect((campo(fixture, 'rol-cliente') as HTMLElement).getAttribute('aria-pressed')).toBe('true');

    page.cambiarRol('TECNICO');
    fixture.detectChanges();
    expect((campo(fixture, 'rol-cliente') as HTMLElement).getAttribute('aria-pressed')).toBe('false');
    expect((campo(fixture, 'rol-tecnico') as HTMLElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('una línea de ayuda cambia con el rol elegido', () => {
    const { fixture, page } = setup();
    const ayuda = () => campo(fixture, 'rol-descripcion')?.textContent?.trim();

    expect(ayuda()).toBe('Necesito un servicio.');
    page.cambiarRol('TECNICO');
    fixture.detectChanges();
    expect(ayuda()).toBe('Presto servicios técnicos.');
    page.cambiarRol('PROVEEDOR');
    fixture.detectChanges();
    expect(ayuda()).toBe('Vendo insumos.');
  });

  it('cambiar de rol conserva lo ya escrito', () => {
    const { fixture, page } = setup();
    page.registroForm.patchValue({ nombre: 'Ana Pérez' });

    page.cambiarRol('PROVEEDOR');
    fixture.detectChanges();

    expect(page.registroForm.value['nombre']).toBe('Ana Pérez');
  });
});
