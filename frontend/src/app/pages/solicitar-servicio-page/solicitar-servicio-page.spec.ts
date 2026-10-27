import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SolicitarServicioPage, esErrorPerfilClienteFaltante } from './solicitar-servicio-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { MapsApi } from '../../core/service/maps-api';
import { MapaConfigService } from '../../core/service/mapa-config.service';
import { SolicitudDraftService } from '../../core/service/solicitud-draft.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OtResponse } from '../../core/models/common.models';

const nuevaOt: OtResponse = {
  id: 'OT-99',
  codigo: 'OT-2026-0099',
  categoriaServicio: 'AIRE_ACONDICIONADO',
  descripcionFalla: 'x',
  estado: 'BUSCANDO_TECNICO',
  auxiliaresRequeridos: 0,
};

function setup() {
  const clientesApi = {
    crearOt: vi.fn(() => of(nuevaOt)),
    crearMiPerfil: vi.fn(() => of({ id: 'cl-new', token: 'nuevo.jwt' })),
    actualizarUbicacion: vi.fn(() => of(undefined)),
  };
  let roles = ['CLIENTE'];
  const auth = {
    currentUser: () => ({ id: 3, nombre: 'María' }),
    userRoles: () => new Set(roles),
    adoptarToken: vi.fn(() => {
      roles = ['TECNICO', 'CLIENTE'];
      return { id: 3, nombre: 'María', rol: 'TECNICO' };
    }),
    logout: vi.fn(),
  };
  const mapsApi = {
    autocompletar: vi.fn(() => of([{ descripcion: 'Calle 15, Caobos', placeId: 'p1' }])),
    geocodificar: vi.fn(() => of({ direccionFormateada: 'Calle 15, Caobos', latitud: 7.89, longitud: -72.5, placeId: 'p1' })),
    inversa: vi.fn(() => of({ direccionFormateada: 'Mi ubicación GPS', latitud: 7.9, longitud: -72.49, placeId: 'p2' })),
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    imports: [SolicitarServicioPage],
    providers: [
      provideRouter([]),
      { provide: ClientesApi, useValue: clientesApi },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
      { provide: MapsApi, useValue: mapsApi },
      // La configuración del mapa la publica el backend (ver mapa-config.service).
      {
        provide: MapaConfigService,
        useValue: {
          centro: () => ({ lat: 7.8939, lng: -72.5078 }),
          radioInicialKm: () => 10,
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  // RouterLink (el CTA de la tarjeta guía) no pasa por `navigate` sino por aquí.
  const navigateUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SolicitarServicioPage);
  fixture.detectChanges();
  return { fixture, clientesApi, mapsApi, toast, auth, navigate, navigateUrl };
}

/** Deja el formulario válido con una ubicación ya fijada en el mapa. */
function prepararFormularioListo(fixture: { componentInstance: SolicitarServicioPage }) {
  const c = fixture.componentInstance;
  c.alFijarEnMapa({ latitud: 7.9, longitud: -72.49 });
  c.solicitudForm.controls.descripcionFalla.setValue('El aire mini-split no enfría y gotea agua.');
}

describe('SolicitarServicioPage', () => {
  beforeEach(() => {
    // El borrador es por pestaña: cada spec arranca sin residuos del anterior.
    window.sessionStorage.clear();
  });

  it('arranca sin dirección ni coordenadas preseleccionadas', () => {
    const { fixture } = setup();
    const raw = fixture.componentInstance.solicitudForm.getRawValue();
    expect(raw.direccion).toBe('');
    expect(raw.descripcionFalla).toBe('');
    expect(raw.latitud).toBeNull();
    expect(raw.longitud).toBeNull();
    expect(fixture.componentInstance.coordenadas()).toBeNull();
  });

  it('cambia la categoría', () => {
    const { fixture } = setup();
    fixture.componentInstance.setCategoria('ELECTRICIDAD');
    expect(fixture.componentInstance.categoriaActual()).toBe('ELECTRICIDAD');
  });

  it('al fijar el punto en el mapa guarda coords, persiste y resuelve la dirección', () => {
    const { fixture, clientesApi, mapsApi } = setup();
    fixture.componentInstance.alFijarEnMapa({ latitud: 7.9, longitud: -72.49 });

    expect(fixture.componentInstance.coordenadas()).toEqual({ latitud: 7.9, longitud: -72.49 });
    expect(mapsApi.inversa).toHaveBeenCalledWith(7.9, -72.49);
    expect(fixture.componentInstance.solicitudForm.controls.direccion.value).toBe('Mi ubicación GPS');
    expect(fixture.componentInstance.solicitudForm.controls.latitud.value).toBe(7.9);
    expect(clientesApi.actualizarUbicacion).toHaveBeenCalledWith({ latitud: 7.9, longitud: -72.49 });
  });

  it('geocodifica una sugerencia seleccionada y fija las coordenadas', () => {
    const { fixture, mapsApi } = setup();
    fixture.componentInstance.seleccionarSugerencia({ descripcion: 'Calle 15, Caobos', placeId: 'p1' });
    expect(mapsApi.geocodificar).toHaveBeenCalledWith('Calle 15, Caobos');
    expect(fixture.componentInstance.solicitudForm.controls.direccion.value).toBe('Calle 15, Caobos');
    expect(fixture.componentInstance.coordenadas()).toEqual({ latitud: 7.89, longitud: -72.5 });
  });

  it('autocompleta la dirección tras el debounce', () => {
    vi.useFakeTimers();
    try {
      const { fixture, mapsApi } = setup();
      fixture.componentInstance.solicitudForm.controls.direccion.setValue('Calle 15 Caobos');
      vi.advanceTimersByTime(350);
      expect(mapsApi.autocompletar).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('carga la foto demo', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.usarFotoDemo();
    expect(fixture.componentInstance.solicitudForm.controls.evidenciaUrl.value).toContain('http');
    expect(toast.info).toHaveBeenCalled();
  });

  it('guarda el borrador y lo restaura al volver al formulario', () => {
    const { fixture } = setup();
    fixture.componentInstance.alFijarEnMapa({ latitud: 7.9, longitud: -72.49 });
    fixture.componentInstance.setCategoria('ELECTRICIDAD');
    fixture.componentInstance.solicitudForm.controls.descripcionFalla.setValue('El tablero hace chispas al encender.');
    fixture.componentInstance.solicitudForm.controls.evidenciaUrl.setValue('https://ejemplo.com/foto.jpg');

    expect(TestBed.inject(SolicitudDraftService).leer()).toMatchObject({
      categoria: 'ELECTRICIDAD',
      descripcion: 'El tablero hace chispas al encender.',
      direccion: 'Mi ubicación GPS',
      coordenadas: { latitud: 7.9, longitud: -72.49 },
      evidenciaUrl: 'https://ejemplo.com/foto.jpg',
    });

    fixture.destroy();
    const reabierto = TestBed.createComponent(SolicitarServicioPage);
    reabierto.detectChanges();
    const page = reabierto.componentInstance;

    expect(page.categoriaActual()).toBe('ELECTRICIDAD');
    expect(page.coordenadas()).toEqual({ latitud: 7.9, longitud: -72.49 });
    expect(page.solicitudForm.controls.direccion.value).toBe('Mi ubicación GPS');
    expect(page.solicitudForm.controls.descripcionFalla.value).toBe('El tablero hace chispas al encender.');
    expect(page.solicitudForm.controls.evidenciaUrl.value).toBe('https://ejemplo.com/foto.jpg');
  });

  it('conserva el borrador si la creación de la OT falla', () => {
    const { fixture, clientesApi } = setup();
    clientesApi.crearOt.mockReturnValue(throwError(() => new ApiHttpError('500', 500)));
    prepararFormularioListo(fixture);

    fixture.componentInstance.onSubmit();

    expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();
  });

  it('limpia el borrador recién cuando la OT se crea', () => {
    const { fixture } = setup();
    prepararFormularioListo(fixture);
    expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();

    fixture.componentInstance.onSubmit();

    expect(TestBed.inject(SolicitudDraftService).leer()).toBeNull();
  });

  it('crea la OT con la ubicación fijada y navega al seguimiento', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    prepararFormularioListo(fixture);
    fixture.componentInstance.onSubmit();

    expect(clientesApi.crearOt).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaServicio: 'AIRE_ACONDICIONADO',
        direccion: 'Mi ubicación GPS',
        latitud: 7.9,
        longitud: -72.49,
      }),
      '3',
      'María',
    );
    const bodyCreado = (clientesApi.crearOt.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(bodyCreado).not.toHaveProperty('barrio');
    // El aviso cita el código legible de la OT; la ruta sigue usando el id interno.
    expect(toast.success).toHaveBeenCalledWith('Solicitud Creada', 'OT OT-2026-0099 transmitida por broadcast (10 km)');
    expect(toast.success).not.toHaveBeenCalledWith('Solicitud Creada', expect.stringContaining('OT-99'));
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'OT-99']);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sin código de OT, el aviso usa el fallback y no el id interno', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    clientesApi.crearOt.mockReturnValue(of({ ...nuevaOt, codigo: undefined }));
    prepararFormularioListo(fixture);
    fixture.componentInstance.onSubmit();

    expect(toast.success).toHaveBeenCalledWith('Solicitud Creada', 'OT Sin código transmitida por broadcast (10 km)');
    expect(toast.success).not.toHaveBeenCalledWith('Solicitud Creada', expect.stringContaining('OT-99'));
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'OT-99']);
  });

  it('no crea la OT si falta la ubicación', () => {
    const { fixture, clientesApi, toast } = setup();
    // Dirección escrita a mano pero sin fijar el punto en el mapa.
    fixture.componentInstance.solicitudForm.controls.direccion.setValue('Calle 15 Caobos');
    fixture.componentInstance.solicitudForm.controls.descripcionFalla.setValue('El aire no enfría para nada.');
    fixture.componentInstance.onSubmit();

    expect(clientesApi.crearOt).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Falta la ubicación', expect.any(String));
  });

  it('no crea la OT con formulario inválido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.solicitudForm.controls.descripcionFalla.setValue('corto');
    fixture.componentInstance.onSubmit();
    expect(clientesApi.crearOt).not.toHaveBeenCalled();
  });

  it('muestra error si falla la creación', () => {
    const { fixture, clientesApi, toast } = setup();
    prepararFormularioListo(fixture);
    // Error no HTTP (p. ej. falla de red): copy neutra de mensaje-error.
    clientesApi.crearOt.mockReturnValue(
      throwError(() => new ApiHttpError('500', 500)),
    );
    fixture.componentInstance.onSubmit();
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo crear la solicitud',
      'Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.',
    );
  });

  // T5: el backend rechaza POST /api/ot con 404 "No existe un perfil de cliente
  // para el usuario: <id>" cuando autenticado dual-role aún no tiene ese perfil.
  describe('guía al alta de perfil de cliente', () => {
    function errorPerfilFaltante(): ApiHttpError {
      return new ApiHttpError('No existe un perfil de cliente para el usuario: 3', 404);
    }

    function tarjeta(fixture: { nativeElement: HTMLElement }): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-test="aviso-perfil-cliente"]') as HTMLElement | null;
    }

    /** Deja el formulario listo, dispara el 404 de perfil faltante y abre la tarjeta. */
    function abrirTarjeta(): ReturnType<typeof setup> {
      const ctx = setup();
      prepararFormularioListo(ctx.fixture);
      ctx.clientesApi.crearOt.mockReturnValueOnce(throwError(() => errorPerfilFaltante()));
      ctx.fixture.componentInstance.onSubmit();
      ctx.fixture.detectChanges();
      return ctx;
    }

    it('detecta el error de perfil de cliente faltante (404 con el mensaje del backend)', () => {
      expect(esErrorPerfilClienteFaltante(errorPerfilFaltante())).toBe(true);
      expect(
        esErrorPerfilClienteFaltante(new ApiHttpError('No existe un perfil de cliente para el usuario: 7', 409)),
      ).toBe(true);
    });

    it('no confunde otros rechazos con el faltante de perfil de cliente', () => {
      expect(esErrorPerfilClienteFaltante(new ApiHttpError('Otra validación', 404))).toBe(false);
      expect(esErrorPerfilClienteFaltante(new Error('Otra falla'))).toBe(false);
    });

    it('muestra la tarjeta con la dirección y la ciudad ya cargadas, sin toast crudo', () => {
      const { fixture, toast } = abrirTarjeta();
      const aviso = tarjeta(fixture);

      expect(fixture.componentInstance.faltoPerfilCliente()).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
      expect(aviso).not.toBeNull();
      expect((aviso?.querySelector('[data-test="perfil-calle"]') as HTMLInputElement).value)
        .toBe('Mi ubicación GPS');
      expect((aviso?.querySelector('[data-test="perfil-ciudad"]') as HTMLInputElement).value)
        .toBe('Cúcuta');
      expect(aviso?.textContent).toContain('Prefiero completar mi perfil por separado');
    });

    it('renderizar la tarjeta de perfil faltante no crea el perfil: el alta solo ocurre al tocar', () => {
      const { fixture, clientesApi } = abrirTarjeta();
      fixture.detectChanges();

      expect(fixture.componentInstance.faltoPerfilCliente()).toBe(true);
      expect(clientesApi.crearMiPerfil).not.toHaveBeenCalled();
    });

    it('el enlace separado vuelve a /perfil/agregar con el returnUrl de la solicitud', () => {
      const { fixture, navigateUrl } = abrirTarjeta();
      const enlace = tarjeta(fixture)?.querySelector(
        'a[data-test="completar-perfil-separado"]',
      ) as HTMLAnchorElement;

      enlace.click();

      // RouterLink entrega un UrlTree (no un string): se compara serializado.
      const destino = String(navigateUrl.mock.calls[0]?.[0] as unknown);
      expect(destino).toContain('/perfil/agregar');
      expect(destino).toContain('returnUrl');
    });

    it('un tap crea el perfil con los datos del borrador y reintenta la misma OT', () => {
      const { fixture, clientesApi, auth, navigate } = abrirTarjeta();
      const page = fixture.componentInstance;
      page.perfilForm.controls.barrio.setValue('Centro');
      const boton = fixture.nativeElement.querySelector(
        '[data-test="crear-perfil-y-enviar"]',
      ) as HTMLButtonElement;

      boton.click();
      fixture.detectChanges();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledWith({
        tipoCliente: 'B2C',
        calle: 'Mi ubicación GPS',
        ciudad: 'Cúcuta',
        barrio: 'Centro',
        ubicacion: { latitud: 7.9, longitud: -72.49 },
      });
      expect(auth.adoptarToken).toHaveBeenCalledWith('nuevo.jwt');
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(2);
      const reintento = (clientesApi.crearOt.mock.calls[1] as unknown[])[0] as Record<string, unknown>;
      expect(reintento).toEqual(
        expect.objectContaining({
          categoriaServicio: 'AIRE_ACONDICIONADO',
          direccion: 'Mi ubicación GPS',
          latitud: 7.9,
          longitud: -72.49,
        }),
      );
      // La OT existe: el borrador se limpia y se sigue en el detalle.
      expect(TestBed.inject(SolicitudDraftService).leer()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'OT-99']);
    });

    it('la dirección corregida en la tarjeta también se usa en la OT reintentada', () => {
      const { fixture, clientesApi } = abrirTarjeta();
      const page = fixture.componentInstance;
      page.perfilForm.controls.calle.setValue('Calle 10 # 4-20, Centro');
      const boton = fixture.nativeElement.querySelector(
        '[data-test="crear-perfil-y-enviar"]',
      ) as HTMLButtonElement;

      boton.click();
      fixture.detectChanges();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ calle: 'Calle 10 # 4-20, Centro' }),
      );
      const reintento = (clientesApi.crearOt.mock.calls[1] as unknown[])[0] as Record<string, unknown>;
      expect(reintento).toEqual(
        expect.objectContaining({ direccion: 'Calle 10 # 4-20, Centro' }),
      );
    });

    it('un doble toque no dispara dos altas de perfil', () => {
      const { fixture, clientesApi } = abrirTarjeta();
      const pendiente = new Subject<{ id: string; token: string }>();
      clientesApi.crearMiPerfil.mockReturnValue(pendiente.asObservable());
      const page = fixture.componentInstance;

      page.crearPerfilYEnviar();
      page.crearPerfilYEnviar();

      expect(clientesApi.crearMiPerfil).toHaveBeenCalledTimes(1);
      pendiente.complete();
    });

    it('si falla el alta del perfil muestra un error honesto y conserva el borrador', () => {
      const { fixture, clientesApi } = abrirTarjeta();
      clientesApi.crearMiPerfil.mockReturnValue(throwError(() => new ApiHttpError('500', 500)));

      const boton = fixture.nativeElement.querySelector(
        '[data-test="crear-perfil-y-enviar"]',
      ) as HTMLButtonElement;
      boton.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.errorCrearPerfil()).toContain('Tus datos siguen acá');
      expect(fixture.nativeElement.querySelector('[data-test="error-crear-perfil"]')).not.toBeNull();
      // No se crea la OT con un perfil que no existe.
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();
    });

    it('un 409 al crear el perfil muestra copy accionable, ofrece login y conserva el borrador', () => {
      const { fixture, clientesApi, auth } = abrirTarjeta();
      clientesApi.crearMiPerfil.mockReturnValue(
        throwError(() => new ApiHttpError('El usuario ya tiene un perfil de cliente: 3', 409)),
      );
      const page = fixture.componentInstance;

      const boton = fixture.nativeElement.querySelector(
        '[data-test="crear-perfil-y-enviar"]',
      ) as HTMLButtonElement;
      boton.click();
      fixture.detectChanges();

      expect(page.errorCrearPerfil()).toBe(
        'Tu perfil de cliente ya existe. Iniciá sesión para continuar; tu solicitud quedó guardada.',
      );
      // No se afirma que el alta falló: el perfil ya está commiteado.
      expect(page.errorCrearPerfil()).not.toContain('No pudimos crear');
      // El alta no se reintenta: se ofrece reautenticarse.
      expect(fixture.nativeElement.querySelector('[data-test="crear-perfil-y-enviar"]')).toBeNull();
      const login = fixture.nativeElement.querySelector(
        '[data-test="iniciar-sesion-perfil-existente"]',
      ) as HTMLButtonElement;
      expect(login).not.toBeNull();
      login.click();
      expect(auth.logout).toHaveBeenCalled();
      // No se crea la OT con una sesión revocada y el borrador sigue intacto.
      expect(clientesApi.crearOt).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(SolicitudDraftService).leer()).not.toBeNull();
    });

    it('la tarjeta desaparece al reintentar con éxito', () => {
      const { fixture, clientesApi, toast } = setup();
      prepararFormularioListo(fixture);
      clientesApi.crearOt.mockReturnValueOnce(throwError(() => errorPerfilFaltante()));
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      expect(tarjeta(fixture)).not.toBeNull();

      prepararFormularioListo(fixture);
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(fixture.componentInstance.faltoPerfilCliente()).toBe(false);
      expect(tarjeta(fixture)).toBeNull();
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
