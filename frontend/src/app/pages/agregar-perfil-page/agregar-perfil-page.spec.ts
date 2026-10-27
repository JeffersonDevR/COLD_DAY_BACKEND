import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AgregarPerfilPage, parseCertificaciones } from './agregar-perfil-page';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ClientesApi } from '../../core/service/clientes-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { Point, Rol } from '../../core/models/common.models';
import { SolicitudDraftService } from '../../core/service/solicitud-draft.service';

interface Mocks {
  auth: {
    userRoles: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    adoptarToken: ReturnType<typeof vi.fn>;
    getDashboardRouteForRole: ReturnType<typeof vi.fn>;
  };
  tecnicosApi: { crearMiPerfil: ReturnType<typeof vi.fn> };
  clientesApi: { crearMiPerfil: ReturnType<typeof vi.fn> };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

interface DraftStub {
  direccion: string;
  coordenadas: Point | null;
}

function setup(
  roles: Rol[],
  returnUrl?: string,
  draft: DraftStub | null = null,
): { fixture: ComponentFixture<AgregarPerfilPage>; mocks: Mocks; navigateByUrl: ReturnType<typeof vi.fn> } {
  const mocks: Mocks = {
    auth: {
      userRoles: vi.fn(() => new Set(roles)),
      logout: vi.fn(),
      adoptarToken: vi.fn(),
      getDashboardRouteForRole: vi.fn((rol: Rol) => (rol === 'TECNICO' ? '/tecnico/ofertas' : '/panel')),
    },
    tecnicosApi: { crearMiPerfil: vi.fn(() => of({ id: 't9' })) },
    clientesApi: { crearMiPerfil: vi.fn(() => of({ id: 'cl2' })) },
    toast: { success: vi.fn(), error: vi.fn() },
  };

  TestBed.configureTestingModule({
    imports: [AgregarPerfilPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(returnUrl !== undefined ? { returnUrl } : {}),
          },
        },
      },
      { provide: AuthService, useValue: mocks.auth },
      { provide: TecnicosApi, useValue: mocks.tecnicosApi },
      { provide: ClientesApi, useValue: mocks.clientesApi },
      { provide: ToastService, useValue: mocks.toast },
      { provide: SolicitudDraftService, useValue: { leer: vi.fn(() => draft) } },
    ],
  });
  const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AgregarPerfilPage);
  fixture.detectChanges();
  return { fixture, mocks, navigateByUrl };
}

function texto(fixture: ComponentFixture<AgregarPerfilPage>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('parseCertificaciones', () => {
  it('divide por líneas, recorta y descarta las vacías', () => {
    const certs = parseCertificaciones('  SENA  \n\nCONTE\n   ');
    expect(certs.map((c) => c.nombre)).toEqual(['SENA', 'CONTE']);
    expect(certs[0]).toEqual({
      nombre: 'SENA',
      institucion: null,
      fechaObtencion: null,
      fechaVencimiento: null,
    });
  });

  it('devuelve una lista vacía cuando no hay texto', () => {
    expect(parseCertificaciones('   \n  ')).toEqual([]);
  });
});

describe('AgregarPerfilPage', () => {
  it('ofrece "Quiero ser técnico" cuando el usuario no tiene perfil de técnico', () => {
    const { fixture } = setup(['CLIENTE']);
    expect(fixture.componentInstance.puedeSerTecnico()).toBe(true);
    expect(texto(fixture)).toContain('Quiero ser técnico');
  });

  it('oculta la CTA de técnico cuando el usuario ya es técnico', () => {
    const { fixture } = setup(['TECNICO']);
    expect(fixture.componentInstance.puedeSerTecnico()).toBe(false);
    expect(fixture.componentInstance.puedeSerCliente()).toBe(true);
    expect(texto(fixture)).not.toContain('Quiero ser técnico');
    expect(texto(fixture)).toContain('Quiero ser cliente');
  });

  it('envía el segundo perfil de técnico con el cuerpo exacto y pide re-login', () => {
    const { fixture, mocks } = setup(['CLIENTE']);
    const page = fixture.componentInstance;
    page.elegir('TECNICO');
    page.formTecnico.controls.numeroIdentificacion.setValue('1098765001');
    page.toggleCategoria('REFRIGERACION');
    page.formTecnico.controls.certificaciones.setValue('SENA');

    page.enviarTecnico();

    expect(mocks.tecnicosApi.crearMiPerfil).toHaveBeenCalledWith({
      numeroIdentificacion: '1098765001',
      categoriasServicio: ['REFRIGERACION'],
      certificaciones: [{ nombre: 'SENA', institucion: null, fechaObtencion: null, fechaVencimiento: null }],
    });
    // La sesión quedó revocada: NO se conserva en silencio.
    expect(page.sesionActualizada()).toBe(true);
    fixture.detectChanges();
    expect(texto(fixture)).toContain('Volvé a iniciar sesión');
  });

  it('prellena la dirección y la ciudad con el borrador de la solicitud en curso', () => {
    const { fixture } = setup(['TECNICO'], undefined, {
      direccion: 'Calle 15 # 3E-28, Caobos',
      coordenadas: { latitud: 7.9, longitud: -72.49 },
    });

    expect(fixture.componentInstance.formCliente.controls.calle.value).toBe('Calle 15 # 3E-28, Caobos');
    expect(fixture.componentInstance.formCliente.controls.ciudad.value).toBe('Cúcuta');
  });

  it('envía la ubicación del borrador cuando existe', () => {
    const { fixture, mocks } = setup(['TECNICO'], undefined, {
      direccion: 'Calle 15 # 3E-28, Caobos',
      coordenadas: { latitud: 7.9, longitud: -72.49 },
    });
    const page = fixture.componentInstance;
    page.elegir('CLIENTE');
    page.formCliente.setValue({
      tipoCliente: 'B2C',
      calle: 'Calle 15 # 3E-28, Caobos',
      ciudad: 'Cúcuta',
      barrio: '',
    });

    page.enviarCliente();

    expect(mocks.clientesApi.crearMiPerfil).toHaveBeenCalledWith(
      expect.objectContaining({
        calle: 'Calle 15 # 3E-28, Caobos',
        ciudad: 'Cúcuta',
        ubicacion: { latitud: 7.9, longitud: -72.49 },
      }),
    );
  });

  it('no envía el perfil de técnico sin identificación ni especialidades', () => {
    const { fixture, mocks } = setup(['CLIENTE']);
    fixture.componentInstance.enviarTecnico();
    expect(mocks.tecnicosApi.crearMiPerfil).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it('envía el segundo perfil de cliente con el cuerpo exacto', () => {
    const { fixture, mocks } = setup(['TECNICO']);
    const page = fixture.componentInstance;
    page.elegir('CLIENTE');
    page.formCliente.setValue({ tipoCliente: 'B2C', calle: 'calle 1', ciudad: 'Cúcuta', barrio: 'Centro' });

    page.enviarCliente();

    expect(mocks.clientesApi.crearMiPerfil).toHaveBeenCalledWith({
      tipoCliente: 'B2C',
      calle: 'calle 1',
      ciudad: 'Cúcuta',
      barrio: 'Centro',
    });
    expect(page.sesionActualizada()).toBe(true);
  });

  describe('sesión renovada al adquirir el segundo perfil', () => {
    it('con token adopta la sesión nueva y vuelve al returnUrl sin logout', () => {
      const { fixture, mocks, navigateByUrl } = setup(['TECNICO'], '/cliente/solicitar');
      mocks.clientesApi.crearMiPerfil.mockReturnValue(of({ id: 'cl2', token: 'nuevo.jwt' }));
      const page = fixture.componentInstance;
      page.elegir('CLIENTE');
      page.formCliente.setValue({ tipoCliente: 'B2C', calle: 'calle 1', ciudad: 'Cúcuta', barrio: '' });

      page.enviarCliente();

      expect(mocks.auth.adoptarToken).toHaveBeenCalledWith('nuevo.jwt');
      expect(navigateByUrl).toHaveBeenCalledWith('/cliente/solicitar');
      expect(mocks.auth.logout).not.toHaveBeenCalled();
      expect(page.sesionActualizada()).toBe(false);
    });

    it('sin returnUrl vuelve al panel del perfil recién adquirido', () => {
      const { fixture, mocks, navigateByUrl } = setup(['TECNICO']);
      mocks.tecnicosApi.crearMiPerfil.mockReturnValue(of({ id: 't9', token: 'nuevo.jwt' }));
      const page = fixture.componentInstance;
      page.elegir('TECNICO');
      page.formTecnico.controls.numeroIdentificacion.setValue('1098765001');
      page.toggleCategoria('REFRIGERACION');

      page.enviarTecnico();

      expect(mocks.auth.getDashboardRouteForRole).toHaveBeenCalledWith('TECNICO');
      expect(navigateByUrl).toHaveBeenCalledWith('/tecnico/ofertas');
    });

    it.each(['https://evil.com', '//evil.com', ''])(
      'ignora el returnUrl no interno %p y cae al panel del perfil',
      (returnUrl) => {
        const { fixture, mocks, navigateByUrl } = setup(['TECNICO'], returnUrl);
        mocks.clientesApi.crearMiPerfil.mockReturnValue(of({ id: 'cl2', token: 'nuevo.jwt' }));
        const page = fixture.componentInstance;
        page.elegir('CLIENTE');
        page.formCliente.setValue({ tipoCliente: 'B2C', calle: 'calle 1', ciudad: 'Cúcuta', barrio: '' });

        page.enviarCliente();

        expect(mocks.auth.adoptarToken).toHaveBeenCalledWith('nuevo.jwt');
        expect(navigateByUrl).toHaveBeenCalledWith('/panel');
      },
    );

    it('sin token conserva el aviso de re-login legado y no navega', () => {
      const { fixture, mocks, navigateByUrl } = setup(['TECNICO']);
      const page = fixture.componentInstance;
      page.elegir('CLIENTE');
      page.formCliente.setValue({ tipoCliente: 'B2C', calle: 'calle 1', ciudad: 'Cúcuta', barrio: '' });

      page.enviarCliente();

      expect(mocks.auth.adoptarToken).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(page.sesionActualizada()).toBe(true);
    });
  });

  it('muestra error si el backend rechaza la adquisición', () => {
    const { fixture, mocks } = setup(['CLIENTE']);
    // 409 real del backend: el usuario ya tiene ese perfil adquirido.
    mocks.tecnicosApi.crearMiPerfil.mockReturnValue(
      throwError(() => new ApiHttpError('El usuario ya tiene un perfil de tecnico: 3', 409)),
    );
    const page = fixture.componentInstance;
    page.elegir('TECNICO');
    page.formTecnico.controls.numeroIdentificacion.setValue('1098765001');
    page.toggleCategoria('REFRIGERACION');

    page.enviarTecnico();

    expect(mocks.toast.error).toHaveBeenCalledWith(
      'No se pudo crear el perfil',
      'Tu perfil de técnico ya existe. Iniciá sesión para continuar.',
    );
    expect(page.errorPerfilExistente()).toBe(
      'Tu perfil de técnico ya existe. Iniciá sesión para continuar.',
    );
    expect(page.sesionActualizada()).toBe(false);
    // La acción de login queda visible y el botón de alta ya no se ofrece.
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-test="iniciar-sesion-perfil-existente"]')).not.toBeNull();
  });

  it('un 409 al adquirir el perfil de cliente muestra copy accionable y ofrece login', () => {
    const { fixture, mocks } = setup(['TECNICO']);
    mocks.clientesApi.crearMiPerfil.mockReturnValue(
      throwError(() => new ApiHttpError('El usuario ya tiene un perfil de cliente: 3', 409)),
    );
    const page = fixture.componentInstance;
    page.elegir('CLIENTE');
    page.formCliente.setValue({ tipoCliente: 'B2C', calle: 'calle 1', ciudad: 'Cúcuta', barrio: '' });

    page.enviarCliente();
    fixture.detectChanges();

    const copy =
      'Tu perfil de cliente ya existe. Iniciá sesión para continuar; tu solicitud quedó guardada.';
    expect(mocks.toast.error).toHaveBeenCalledWith('No se pudo crear el perfil', copy);
    expect(texto(fixture)).toContain(copy);
    expect(page.errorPerfilExistente()).toBe(copy);
    const login = fixture.nativeElement.querySelector(
      '[data-test="iniciar-sesion-perfil-existente"]',
    ) as HTMLButtonElement;
    login.click();
    expect(mocks.auth.logout).toHaveBeenCalled();
    // No se afirma que el alta falló: el perfil ya existe.
    expect(texto(fixture)).not.toContain('No pudimos crear');
  });

  it('al confirmar, cierra la sesión revocada y vuelve a login', () => {
    const { fixture, mocks } = setup(['CLIENTE']);
    fixture.componentInstance.irAIniciarSesion();
    expect(mocks.auth.logout).toHaveBeenCalled();
  });
});
