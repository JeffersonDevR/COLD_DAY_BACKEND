import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter, Router } from '@angular/router';
import { WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import {
  CategoriaServicio,
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
  alternarEspecialidad(categoria: CategoriaServicio): void;
  alternarPassword(): void;
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
  confirmacion: 'secreto1',
  aceptaHabeasData: true,
};

function llenarCliente(page: RegistroPageInternals, extra: Record<string, unknown> = {}) {
  page.registroForm.patchValue({
    ...base,
    calle: 'Calle 10 # 5-20',
    ciudad: 'Cúcuta',
    ...extra,
  });
}

function llenarTecnico(page: RegistroPageInternals) {
  page.cambiarRol('TECNICO');
  page.registroForm.patchValue({
    ...base,
    correo: 'tecnico@coldday.co',
    numeroIdentificacion: '1098765001',
  });
}

function llenarProveedor(page: RegistroPageInternals) {
  page.cambiarRol('PROVEEDOR');
  page.registroForm.patchValue({
    ...base,
    nombre: 'Juan Pérez',
    correo: 'proveedor@coldday.co',
    razonSocial: 'Suministros del Norte S.A.S.',
    nit: '900123456-1',
  });
}

function campo(fixture: ComponentFixture<RegistroPage>, testId: string): Element | null {
  return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
}

describe('RegistroPage móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('arranca como cliente y solo muestra los campos de cliente', () => {
    const { fixture, page } = setup();

    expect(page.rol()).toBe('CLIENTE');
    expect(campo(fixture, 'campos-cliente')).not.toBeNull();
    expect(campo(fixture, 'tipo-cliente')).not.toBeNull();
    expect(campo(fixture, 'calle')).not.toBeNull();
    expect(campo(fixture, 'ciudad')).not.toBeNull();
    expect(campo(fixture, 'campos-tecnico')).toBeNull();
    expect(campo(fixture, 'campos-proveedor')).toBeNull();
  });

  it('el selector de rol cambia el set de campos', () => {
    const { fixture, page } = setup();

    (campo(fixture, 'rol-tecnico') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.rol()).toBe('TECNICO');
    expect(campo(fixture, 'campos-tecnico')).not.toBeNull();
    expect(campo(fixture, 'numero-identificacion')).not.toBeNull();
    expect(campo(fixture, 'campos-cliente')).toBeNull();

    (campo(fixture, 'rol-proveedor') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.rol()).toBe('PROVEEDOR');
    expect(campo(fixture, 'campos-proveedor')).not.toBeNull();
    expect(campo(fixture, 'nit')).not.toBeNull();
    expect(campo(fixture, 'campos-tecnico')).toBeNull();
  });

  it('con campos vacíos no llama al backend y muestra los errores de campo', () => {
    const { fixture, page, clientesApi } = setup();

    page.enviar();
    fixture.detectChanges();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
    expect(page.error()).toBeNull();
    expect(campo(fixture, 'error-nombre')?.textContent).toContain('Ingresá tu nombre');
    expect(campo(fixture, 'error-calle')?.textContent).toContain('calle');
    expect(campo(fixture, 'error-habeas')?.textContent).toContain('tratamiento de datos');
  });

  it('cliente: crea la cuenta con el DTO del endpoint atómico y adopta la sesión', () => {
    const { page, clientesApi, usuariosApi, auth, toast, navigate } = setup();
    llenarCliente(page);

    page.enviar();

    expect(clientesApi.registrarCliente).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      correo: 'ana@coldday.co',
      password: 'secreto1',
      telefono: '3001234567',
      tipoCliente: 'B2C',
      calle: 'Calle 10 # 5-20',
      ciudad: 'Cúcuta',
      aceptaHabeasData: true,
    });
    expect(usuariosApi.login).toHaveBeenCalledWith('ana@coldday.co', 'secreto1');
    expect(auth.establecerSesionDesdeToken).toHaveBeenCalledWith(respuesta, 'ana@coldday.co');
    expect(toast.success).toHaveBeenCalledWith('Cuenta creada', expect.any(String));
    expect(navigate).toHaveBeenCalledWith('/cliente/panel');
    expect(page.loading()).toBe(false);
  });

  it('cliente: respeta el tipo de cliente B2B', () => {
    const { page, clientesApi } = setup();
    llenarCliente(page, { tipoCliente: 'B2B' });

    page.enviar();

    expect(clientesApi.registrarCliente).toHaveBeenCalledWith(
      expect.objectContaining({ tipoCliente: 'B2B' }),
    );
  });

  it('técnico: exige identificación antes de llamar al backend', () => {
    const { fixture, page, tecnicosApi } = setup();
    llenarTecnico(page);
    page.registroForm.patchValue({ numeroIdentificacion: '' });

    page.enviar();
    fixture.detectChanges();

    expect(tecnicosApi.registrar).not.toHaveBeenCalled();
    expect(campo(fixture, 'error-identificacion')?.textContent).toContain('identificación');
  });

  it('técnico: envía especialidades y certificaciones vacías como la web', () => {
    const { page, tecnicosApi, navigate } = setup({ home: '/tecnico/radar' });
    llenarTecnico(page);

    page.enviar();

    expect(tecnicosApi.registrar).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      correo: 'tecnico@coldday.co',
      password: 'secreto1',
      telefono: '3001234567',
      numeroIdentificacion: '1098765001',
      categoriasServicio: ['AIRE_ACONDICIONADO', 'REFRIGERACION'],
      certificaciones: [],
      aceptaHabeasData: true,
    });
    expect(navigate).toHaveBeenCalledWith('/tecnico/radar');
  });

  it('técnico: sin especialidades no envía y avisa', () => {
    const { fixture, page, tecnicosApi } = setup();
    llenarTecnico(page);

    page.alternarEspecialidad('AIRE_ACONDICIONADO');
    page.alternarEspecialidad('REFRIGERACION');
    fixture.detectChanges();

    expect(campo(fixture, 'error-especialidades')?.textContent).toContain(
      'al menos una especialidad',
    );

    page.enviar();

    expect(tecnicosApi.registrar).not.toHaveBeenCalled();
  });

  it('proveedor: crea la identidad comercial sin pedir dirección y aterriza en su expediente', () => {
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
      razonSocial: 'Suministros del Norte S.A.S.',
      nit: '900123456-1',
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

  it('contraseñas distintas bloquean el alta y se explican', () => {
    const { fixture, page, clientesApi } = setup();
    llenarCliente(page, { confirmacion: 'otra-clave' });

    page.enviar();
    fixture.detectChanges();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
    expect(campo(fixture, 'error-confirmacion')?.textContent).toContain('no coinciden');
  });

  it('sin aceptar Habeas Data no se crea la cuenta', () => {
    const { page, clientesApi } = setup();
    llenarCliente(page, { aceptaHabeasData: false });

    page.enviar();

    expect(clientesApi.registrarCliente).not.toHaveBeenCalled();
  });

  it('el toggle de contraseñas afecta a los dos campos y se anuncia por aria-label', () => {
    const { fixture, page } = setup();
    const toggle = campo(fixture, 'toggle-password') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-label')).toContain('Mostrar');
    expect(toggle.querySelector('ion-icon')).not.toBeNull();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toContain('Ocultar');
    page.alternarPassword();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toContain('Mostrar');
  });

  it('ofrece el enlace al login', () => {
    const { fixture } = setup();

    expect(campo(fixture, 'ir-login')?.getAttribute('href')).toBe('/login');
  });
});
