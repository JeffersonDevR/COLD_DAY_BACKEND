import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AgregarPerfilPage, parseCertificaciones } from './agregar-perfil-page';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ClientesApi } from '../../core/service/clientes-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { Rol } from '../../core/models/common.models';

interface Mocks {
  auth: { userRoles: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> };
  tecnicosApi: { crearMiPerfil: ReturnType<typeof vi.fn> };
  clientesApi: { crearMiPerfil: ReturnType<typeof vi.fn> };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function setup(roles: Rol[]): { fixture: ComponentFixture<AgregarPerfilPage>; mocks: Mocks } {
  const mocks: Mocks = {
    auth: { userRoles: vi.fn(() => new Set(roles)), logout: vi.fn() },
    tecnicosApi: { crearMiPerfil: vi.fn(() => of({ id: 't9' })) },
    clientesApi: { crearMiPerfil: vi.fn(() => of({ id: 'cl2' })) },
    toast: { success: vi.fn(), error: vi.fn() },
  };

  TestBed.configureTestingModule({
    imports: [AgregarPerfilPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: mocks.auth },
      { provide: TecnicosApi, useValue: mocks.tecnicosApi },
      { provide: ClientesApi, useValue: mocks.clientesApi },
      { provide: ToastService, useValue: mocks.toast },
    ],
  });
  const fixture = TestBed.createComponent(AgregarPerfilPage);
  fixture.detectChanges();
  return { fixture, mocks };
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
      'Ya tenés ese perfil. Volvé al panel y actualizá la página si es necesario.',
    );
    expect(page.sesionActualizada()).toBe(false);
  });

  it('al confirmar, cierra la sesión revocada y vuelve a login', () => {
    const { fixture, mocks } = setup(['CLIENTE']);
    fixture.componentInstance.irAIniciarSesion();
    expect(mocks.auth.logout).toHaveBeenCalled();
  });
});
