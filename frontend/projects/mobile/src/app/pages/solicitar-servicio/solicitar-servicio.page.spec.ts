import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter, Router } from '@angular/router';
import { WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { MENSAJE_PERFIL_CLIENTE_YA_EXISTE } from '@core/errorStatus/perfil-cliente';
import { CategoriaServicio, OtResponse, Point } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ClientesApi } from '@core/service/clientes-api';
import { GeolocationService } from '@core/service/geolocation.service';
import { MapaConfigService } from '@core/service/mapa-config.service';
import { MapsApi } from '@core/service/maps-api';
import { SolicitudDraftService } from '@core/service/solicitud-draft.service';
import { MobileToastService } from '../../core/toast.service';
import { SolicitarServicioPage } from './solicitar-servicio.page';

const nuevaOt: OtResponse = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  codigo: 'OT-2026-0099',
  categoriaServicio: 'AIRE_ACONDICIONADO',
  descripcionFalla: 'x',
  estado: 'BUSCANDO_TECNICO',
  auxiliaresRequeridos: 0,
};

const PUNTO_GEOCODIFICADO: Point = { latitud: 7.89, longitud: -72.5 };
const PUNTO_GPS: Point = { latitud: 7.9, longitud: -72.49 };

interface SolicitarInternals {
  readonly categoria: WritableSignal<CategoriaServicio>;
  readonly coordenadas: WritableSignal<Point | null>;
  readonly loading: WritableSignal<boolean>;
  readonly geocodificando: WritableSignal<boolean>;
  readonly faltoPerfilCliente: WritableSignal<boolean>;
  readonly creandoPerfil: WritableSignal<boolean>;
  readonly errorCrearPerfil: WritableSignal<string | null>;
  readonly perfilYaExistia: WritableSignal<boolean>;
  readonly solicitudForm: FormGroup;
  readonly perfilForm: FormGroup;
  setCategoria(categoria: CategoriaServicio): void;
  geocodificar(): void;
  usarMiUbicacion(): void;
  enviar(): void;
  crearPerfilYEnviar(): void;
  listoParaEnviar(): boolean;
}

function setup(
  opciones: {
    crearOt?: Observable<OtResponse>;
    crearMiPerfil?: Observable<{ id: string; token?: string }>;
    geocodificar?: Observable<unknown>;
    inversa?: Observable<unknown>;
    posicion?: Observable<Point>;
  } = {},
) {
  const clientesApi = {
    crearOt: vi.fn(() => opciones.crearOt ?? of(nuevaOt)),
    crearMiPerfil: vi.fn(() => opciones.crearMiPerfil ?? of({ id: 'cl-new', token: 'nuevo.jwt' })),
    actualizarUbicacion: vi.fn(() => of(undefined)),
  };
  const mapsApi = {
    geocodificar: vi.fn(
      () =>
        opciones.geocodificar ??
        of({
          direccionFormateada: 'Calle 15 # 3E-28, Los Caobos, Cúcuta',
          latitud: PUNTO_GEOCODIFICADO.latitud,
          longitud: PUNTO_GEOCODIFICADO.longitud,
          placeId: 'p1',
        }),
    ),
    inversa: vi.fn(
      () =>
        opciones.inversa ??
        of({
          direccionFormateada: 'Mi ubicación GPS',
          latitud: PUNTO_GPS.latitud,
          longitud: PUNTO_GPS.longitud,
          placeId: 'p2',
        }),
    ),
  };
  const geolocation = {
    obtenerPosicion: vi.fn(() => opciones.posicion ?? of(PUNTO_GPS)),
  };
  const mapaConfig = {
    cargar: vi.fn(() => Promise.resolve({})),
    radioInicialKm: () => 10,
    centro: () => ({ lat: 7.8939, lng: -72.5078 }),
  };
  const auth = {
    currentUser: () => ({ id: 3, nombre: 'María' }),
    adoptarToken: vi.fn(),
    logout: vi.fn(),
  };
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: ClientesApi, useValue: clientesApi },
      { provide: MapsApi, useValue: mapsApi },
      { provide: GeolocationService, useValue: geolocation },
      { provide: MapaConfigService, useValue: mapaConfig },
      { provide: AuthService, useValue: auth },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture: ComponentFixture<SolicitarServicioPage> =
    TestBed.createComponent(SolicitarServicioPage);
  fixture.detectChanges();
  const page = fixture.componentInstance as unknown as SolicitarInternals;
  return { fixture, page, clientesApi, mapsApi, geolocation, auth, toast, navigate };
}

/** Formulario válido + punto fijado: el estado mínimo para poder enviar. */
function prepararSolicitud(page: SolicitarInternals): void {
  page.solicitudForm.setValue({
    descripcionFalla: 'El aire mini-split no enfría y gotea agua.',
    direccion: 'Calle 15 # 3E-28',
  });
  page.geocodificar();
}

function estaDeshabilitado(elemento: Element | null): boolean {
  if (!elemento) throw new Error('el elemento no existe');
  return elemento.hasAttribute('disabled') || (elemento as { disabled?: boolean }).disabled === true;
}

function errorPerfilFaltante(): ApiHttpError {
  return new ApiHttpError('No existe un perfil de cliente para el usuario: 3', 404);
}

describe('SolicitarServicioPage móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    window.sessionStorage.clear();
  });

  it('arranca sin dirección ni coordenadas y con el formulario inválido', () => {
    const { fixture, page } = setup();

    expect(page.solicitudForm.getRawValue()).toEqual({
      descripcionFalla: '',
      direccion: '',
    });
    expect(page.coordenadas()).toBeNull();
    expect(page.listoParaEnviar()).toBe(false);
    expect(
      estaDeshabilitado(fixture.nativeElement.querySelector('[data-testid="enviar"]')),
    ).toBe(true);
  });

  it('no envía con el formulario incompleto', () => {
    const { page, clientesApi } = setup();

    page.enviar();
    expect(clientesApi.crearOt).not.toHaveBeenCalled();

    page.solicitudForm.setValue({ descripcionFalla: 'corto', direccion: 'Calle 15 # 3E-28' });
    page.enviar();
    expect(clientesApi.crearOt).not.toHaveBeenCalled();
  });

  it('no envía aunque el formulario sea válido si falta la ubicación', () => {
    const { page, clientesApi, toast } = setup();
    page.solicitudForm.setValue({
      descripcionFalla: 'El aire mini-split no enfría y gotea agua.',
      direccion: 'Calle 15 # 3E-28',
    });

    page.enviar();

    expect(clientesApi.crearOt).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Falta la ubicación', expect.any(String));
  });

  it('geocodificar fija las coordenadas y habilita el envío', () => {
    const { fixture, page, mapsApi } = setup();
    page.solicitudForm.setValue({
      descripcionFalla: 'El aire mini-split no enfría y gotea agua.',
      direccion: 'Calle 15 Caobos',
    });
    expect(page.listoParaEnviar()).toBe(false);

    (fixture.nativeElement.querySelector('[data-testid="geocodificar"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(mapsApi.geocodificar).toHaveBeenCalledWith('Calle 15 Caobos');
    expect(page.coordenadas()).toEqual(PUNTO_GEOCODIFICADO);
    expect(page.listoParaEnviar()).toBe(true);
    // La dirección formateada por el backend reemplaza lo tipeado.
    expect(page.solicitudForm.controls['direccion'].value).toContain('Los Caobos');
    expect(fixture.nativeElement.textContent).toContain('Latitud 7.8900');
  });

  it('con menos de 5 caracteres no gasta una geocodificación', () => {
    const { page, mapsApi, toast } = setup();
    page.solicitudForm.controls['direccion'].setValue('Cl 1');

    page.geocodificar();

    expect(mapsApi.geocodificar).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Falta la dirección', expect.any(String));
  });

  it('"Usar mi ubicación" toma el GPS y resuelve la dirección por geocodificación inversa', () => {
    const { fixture, page, mapsApi, geolocation, clientesApi } = setup();

    (fixture.nativeElement.querySelector('[data-testid="usar-ubicacion"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(geolocation.obtenerPosicion).toHaveBeenCalled();
    expect(page.coordenadas()).toEqual(PUNTO_GPS);
    expect(mapsApi.inversa).toHaveBeenCalledWith(PUNTO_GPS.latitud, PUNTO_GPS.longitud);
    expect(page.solicitudForm.controls['direccion'].value).toBe('Mi ubicación GPS');
    expect(clientesApi.actualizarUbicacion).toHaveBeenCalledWith(PUNTO_GPS);
  });

  it('si el permiso de ubicación se niega, avisa con el copy del GPS y no fija el punto', () => {
    const { page, toast } = setup({
      posicion: throwError(() => ({ code: 1 })),
    });

    page.usarMiUbicacion();

    expect(page.coordenadas()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'Sin ubicación',
      expect.stringContaining('Permiso de ubicación denegado'),
    );
  });

  it('guarda el borrador y lo restaura al volver a la pantalla', () => {
    const { fixture, page } = setup();
    page.setCategoria('ELECTRICIDAD');
    prepararSolicitud(page);

    const draft = TestBed.inject(SolicitudDraftService).leer();
    expect(draft).toMatchObject({
      categoria: 'ELECTRICIDAD',
      descripcion: 'El aire mini-split no enfría y gotea agua.',
      direccion: 'Calle 15 # 3E-28, Los Caobos, Cúcuta',
      coordenadas: PUNTO_GEOCODIFICADO,
    });
    // Sin foto de evidencia en esta entrega.
    expect(draft?.evidenciaUrl).toBe('');

    fixture.destroy();
    const reabierto = TestBed.createComponent(SolicitarServicioPage);
    reabierto.detectChanges();
    const nueva = reabierto.componentInstance as unknown as SolicitarInternals;

    expect(nueva.categoria()).toBe('ELECTRICIDAD');
    expect(nueva.coordenadas()).toEqual(PUNTO_GEOCODIFICADO);
    expect(nueva.solicitudForm.controls['descripcionFalla'].value).toContain('no enfría');
    expect(nueva.solicitudForm.controls['direccion'].value).toContain('Los Caobos');
    expect(nueva.listoParaEnviar()).toBe(true);
  });

  it('crea la OT con el punto y el aviso cita el código, no el id interno', () => {
    const { page, clientesApi, toast, navigate } = setup();
    prepararSolicitud(page);

    page.enviar();

    expect(clientesApi.crearOt).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaServicio: 'AIRE_ACONDICIONADO',
        descripcionFalla: 'El aire mini-split no enfría y gotea agua.',
        latitud: PUNTO_GEOCODIFICADO.latitud,
        longitud: PUNTO_GEOCODIFICADO.longitud,
      }),
      '3',
      'María',
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Solicitud creada',
      'OT OT-2026-0099 transmitida por broadcast (10 km)',
    );
    expect(toast.success).not.toHaveBeenCalledWith(
      'Solicitud creada',
      expect.stringContaining(nuevaOt.id),
    );
    // A6: al crear la OT el cliente aterriza en su seguimiento.
    expect(navigate).toHaveBeenCalledWith(`/cliente/ot/${nuevaOt.id}`);
    expect(page.loading()).toBe(false);
  });

  it('limpia el borrador solo cuando la OT se crea', () => {
    const { page, clientesApi } = setup({
      crearOt: throwError(() => new ApiHttpError('boom', 500)),
    });
    prepararSolicitud(page);

    page.enviar();

    expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();

    clientesApi.crearOt.mockReturnValue(of(nuevaOt));
    page.enviar();

    expect(TestBed.inject(SolicitudDraftService).leer()).toBeNull();
  });

  it('un fallo de red muestra el copy humano y no navega', () => {
    const { page, toast, navigate } = setup({
      crearOt: throwError(() => new ApiHttpError('boom', 500)),
    });
    prepararSolicitud(page);

    page.enviar();

    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos crear la solicitud',
      'Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no permite un doble envío de la misma OT', () => {
    const pendiente = new Subject<OtResponse>();
    const { page, clientesApi } = setup({ crearOt: pendiente.asObservable() });
    prepararSolicitud(page);

    page.enviar();
    page.enviar();

    expect(clientesApi.crearOt).toHaveBeenCalledTimes(1);
    pendiente.complete();
  });

  describe('alta del perfil de cliente en un toque', () => {
    /** Dispara el 404 de perfil faltante y deja la tarjeta abierta. */
    function abrirTarjeta() {
      const contexto = setup();
      prepararSolicitud(contexto.page);
      contexto.clientesApi.crearOt.mockReturnValueOnce(throwError(() => errorPerfilFaltante()));
      contexto.page.enviar();
      contexto.fixture.detectChanges();
      return contexto;
    }

    function tarjeta(fixture: ComponentFixture<SolicitarServicioPage>): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="aviso-perfil-cliente"]');
    }

    it('la tarjeta aparece con la dirección y la ciudad ya cargadas, sin crear nada', () => {
      const { fixture, page, clientesApi, toast } = abrirTarjeta();

      expect(page.faltoPerfilCliente()).toBe(true);
      expect(tarjeta(fixture)).not.toBeNull();
      expect(page.perfilForm.getRawValue()).toMatchObject({
        tipoCliente: 'B2C',
        calle: 'Calle 15 # 3E-28, Los Caobos, Cúcuta',
        ciudad: 'Cúcuta',
      });
      // El 404 de perfil no se anuncia con un toast genérico: tiene su tarjeta.
      expect(toast.error).not.toHaveBeenCalled();
      // El tap es el consentimiento.
      expect(clientesApi.crearMiPerfil).not.toHaveBeenCalled();
    });

    it('el tap crea el perfil, adopta el token y reintenta la misma OT', () => {
      const { fixture, page, clientesApi, auth, navigate } = abrirTarjeta();
      const boton = fixture.nativeElement.querySelector(
        '[data-testid="crear-perfil-y-enviar"]',
      ) as HTMLElement;

      boton.click();
      fixture.detectChanges();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledWith({
        tipoCliente: 'B2C',
        calle: 'Calle 15 # 3E-28, Los Caobos, Cúcuta',
        ciudad: 'Cúcuta',
        barrio: undefined,
        ubicacion: PUNTO_GEOCODIFICADO,
      });
      expect(auth.adoptarToken).toHaveBeenCalledWith('nuevo.jwt');
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(2);
      expect(page.faltoPerfilCliente()).toBe(false);
      expect(TestBed.inject(SolicitudDraftService).leer()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(`/cliente/ot/${nuevaOt.id}`);
    });

    it('la dirección corregida en la tarjeta también se usa en la OT reintentada', () => {
      const { fixture, page, clientesApi } = abrirTarjeta();
      page.perfilForm.controls['calle'].setValue('Calle 10 # 4-20, Centro');

      (
        fixture.nativeElement.querySelector('[data-testid="crear-perfil-y-enviar"]') as HTMLElement
      ).click();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ calle: 'Calle 10 # 4-20, Centro' }),
      );
      const reintento = (clientesApi.crearOt.mock.calls[1] as unknown[])[0] as Record<
        string,
        unknown
      >;
      expect(reintento).toEqual(expect.objectContaining({ direccion: 'Calle 10 # 4-20, Centro' }));
    });

    it('un doble toque no dispara dos altas de perfil', () => {
      const { page, clientesApi } = abrirTarjeta();
      const pendiente = new Subject<{ id: string; token: string }>();
      clientesApi.crearMiPerfil.mockReturnValue(pendiente.asObservable());

      page.crearPerfilYEnviar();
      page.crearPerfilYEnviar();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledTimes(1);
      pendiente.complete();
    });

    it('si falla el alta muestra un error honesto, conserva el borrador y no crea la OT', () => {
      const { fixture, page, clientesApi } = abrirTarjeta();
      clientesApi.crearMiPerfil.mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));

      (
        fixture.nativeElement.querySelector('[data-testid="crear-perfil-y-enviar"]') as HTMLElement
      ).click();
      fixture.detectChanges();

      expect(page.errorCrearPerfil()).toContain('Tus datos siguen acá');
      expect(fixture.nativeElement.querySelector('[data-testid="error-crear-perfil"]')).not.toBeNull();
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();
    });

    it('un 409 del alta avisa que el perfil ya existe, ofrece login y conserva el borrador', () => {
      const { fixture, page, clientesApi, auth, navigate } = abrirTarjeta();
      clientesApi.crearMiPerfil.mockReturnValue(
        throwError(() => new ApiHttpError('El usuario ya tiene un perfil de cliente: 3', 409)),
      );

      (
        fixture.nativeElement.querySelector('[data-testid="crear-perfil-y-enviar"]') as HTMLElement
      ).click();
      fixture.detectChanges();

      expect(page.errorCrearPerfil()).toBe(MENSAJE_PERFIL_CLIENTE_YA_EXISTE);
      expect(page.perfilYaExistia()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      // El alta no se reintenta con una sesión revocada.
      expect(
        fixture.nativeElement.querySelector('[data-testid="crear-perfil-y-enviar"]'),
      ).toBeNull();
      const login = fixture.nativeElement.querySelector(
        '[data-testid="perfil-iniciar-sesion"]',
      ) as HTMLElement;
      expect(login).not.toBeNull();
      login.click();
      expect(auth.logout).toHaveBeenCalled();
      expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();
    });

    it('sin token de reemplazo no reintenta la OT y pide renovar la sesión', () => {
      const { fixture, page, clientesApi, auth } = abrirTarjeta();
      clientesApi.crearMiPerfil.mockReturnValue(of({ id: 'cl-new' }));

      (
        fixture.nativeElement.querySelector('[data-testid="crear-perfil-y-enviar"]') as HTMLElement
      ).click();
      fixture.detectChanges();

      expect(auth.adoptarToken).not.toHaveBeenCalled();
      expect(page.errorCrearPerfil()).toContain('la sesión necesita renovarse');
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(1);
    });
  });
});
