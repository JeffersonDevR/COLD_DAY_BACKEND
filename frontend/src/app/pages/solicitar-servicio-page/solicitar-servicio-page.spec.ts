import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
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
    actualizarUbicacion: vi.fn(() => of(undefined)),
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
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3, nombre: 'María' }), userRoles: () => new Set(['CLIENTE']) } },
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
  return { fixture, clientesApi, mapsApi, toast, navigate, navigateUrl };
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

    function arguesUI(fixture: { nativeElement: HTMLElement }): { aviso: HTMLElement; cta: HTMLAnchorElement } | null {
      const aviso = fixture.nativeElement.querySelector('[data-test="aviso-perfil-cliente"]') as HTMLElement | null;
      if (!aviso) return null;
      const cta = aviso.querySelector('a[data-test="cta-crear-perfil-cliente"]') as HTMLAnchorElement;
      return { aviso, cta };
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

    it('muestra la tarjeta guía con el CTA hacia /perfil/agregar y no avisa con toast crudo', () => {
      const { fixture, clientesApi, toast } = setup();
      prepararFormularioListo(fixture);
      clientesApi.crearOt.mockReturnValue(throwError(() => errorPerfilFaltante()));
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(fixture.componentInstance.faltoPerfilCliente()).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
      const ui = arguesUI(fixture);
      expect(ui).not.toBeNull();
      expect(ui?.cta.getAttribute('routerlink')).toBe('/perfil/agregar');
      expect(ui?.cta.textContent).toContain('Crear mi perfil de cliente');
    });

    it('navega a /perfil/agregar al activar el CTA', () => {
      const { fixture, clientesApi, navigateUrl } = setup();
      prepararFormularioListo(fixture);
      clientesApi.crearOt.mockReturnValue(throwError(() => errorPerfilFaltante()));
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      const cta = arguesUI(fixture)?.cta;
      cta!.click();
      // RouterLink entrega un UrlTree (no un string): se compara serializado.
      const destino = navigateUrl.mock.calls[0]?.[0] as unknown;
      expect(String(destino)).toBe('/perfil/agregar');
    });

    it('la tarjeta desaparece al reintentar con éxito', () => {
      const { fixture, clientesApi, toast } = setup();
      prepararFormularioListo(fixture);
      clientesApi.crearOt.mockReturnValueOnce(throwError(() => errorPerfilFaltante()));
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      expect(arguesUI(fixture)).not.toBeNull();

      prepararFormularioListo(fixture);
      fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(fixture.componentInstance.faltoPerfilCliente()).toBe(false);
      expect(arguesUI(fixture)).toBeNull();
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
