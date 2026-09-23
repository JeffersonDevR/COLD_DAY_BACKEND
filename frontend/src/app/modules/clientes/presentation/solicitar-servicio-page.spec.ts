import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SolicitarServicioPage } from './solicitar-servicio-page';
import { ClientesApi } from '../infrastructure/clientes-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { GeolocationService } from '../../../core/shared/infrastructure/geolocation/geolocation.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const nuevaOt: OtResponse = {
  id: 'OT-99',
  categoriaServicio: 'AIRE_ACONDICIONADO',
  descripcionFalla: 'x',
  estado: 'BUSCANDO_TECNICO',
  auxiliaresRequeridos: 0,
};

function setup(opts: { disponible?: boolean } = {}) {
  const clientesApi = {
    crearOt: vi.fn(() => of(nuevaOt)),
    actualizarUbicacion: vi.fn(() => of(undefined)),
  };
  const mapsApi = {
    autocompletar: vi.fn(() => of([{ descripcion: 'Calle 15, Caobos', placeId: 'p1' }])),
    geocodificar: vi.fn(() => of({ direccionFormateada: 'Calle 15, Caobos', latitud: 7.89, longitud: -72.5, placeId: 'p1' })),
    inversa: vi.fn(() => of({ direccionFormateada: 'Mi ubicación GPS', latitud: 7.9, longitud: -72.49, placeId: 'p2' })),
  };
  const geolocation = {
    disponible: opts.disponible ?? true,
    obtenerPosicion: vi.fn(() => of({ latitud: 7.9, longitud: -72.49 })),
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    imports: [SolicitarServicioPage],
    providers: [
      provideRouter([]),
      { provide: ClientesApi, useValue: clientesApi },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3, nombre: 'María' }) } },
      { provide: ToastService, useValue: toast },
      { provide: MapsApi, useValue: mapsApi },
      { provide: GeolocationService, useValue: geolocation },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SolicitarServicioPage);
  fixture.detectChanges();
  return { fixture, clientesApi, mapsApi, geolocation, toast, navigate };
}

describe('SolicitarServicioPage', () => {
  it('cambia la categoría y selecciona barrio', () => {
    const { fixture } = setup();
    fixture.componentInstance.setCategoria('ELECTRICIDAD');
    expect(fixture.componentInstance.categoriaActual()).toBe('ELECTRICIDAD');

    fixture.componentInstance.seleccionarBarrio({ nombre: 'Centro', lat: 1, lng: 2 });
    expect(fixture.componentInstance.barrioSeleccionado()).toBe('Centro');
    expect(fixture.componentInstance.solicitudForm.getRawValue()).toMatchObject({ latitud: 1, longitud: 2 });
  });

  it('carga la foto demo', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.usarFotoDemo();
    expect(fixture.componentInstance.solicitudForm.controls.evidenciaUrl.value).toContain('http');
    expect(toast.info).toHaveBeenCalled();
  });

  it('crea la OT y navega al seguimiento', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.onSubmit();

    expect(clientesApi.crearOt).toHaveBeenCalledWith(
      expect.objectContaining({ categoriaServicio: 'AIRE_ACONDICIONADO', barrio: 'Los Caobos' }),
      '3',
      'María',
    );
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'OT-99']);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('no crea la OT con formulario inválido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.solicitudForm.controls.descripcionFalla.setValue('corto');
    fixture.componentInstance.onSubmit();
    expect(clientesApi.crearOt).not.toHaveBeenCalled();
  });

  it('muestra error si falla la creación', () => {
    const { fixture, clientesApi, toast } = setup();
    clientesApi.crearOt.mockReturnValue(throwError(() => new Error('500')));
    fixture.componentInstance.onSubmit();
    expect(toast.error).toHaveBeenCalledWith('No se pudo crear la solicitud', '500');
  });

  it('usa la ubicación del dispositivo', () => {
    const { fixture, clientesApi, toast } = setup();
    fixture.componentInstance.usarMiUbicacion();

    expect(fixture.componentInstance.solicitudForm.controls.latitud.value).toBe(7.9);
    expect(clientesApi.actualizarUbicacion).toHaveBeenCalledWith({ latitud: 7.9, longitud: -72.49 });
    expect(toast.success).toHaveBeenCalled();
    expect(fixture.componentInstance.ubicando()).toBe(false);
  });

  it('avisa si la geolocalización no está disponible', () => {
    const { fixture, geolocation, toast } = setup({ disponible: false });
    fixture.componentInstance.usarMiUbicacion();
    expect(geolocation.obtenerPosicion).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No disponible', expect.any(String));
  });

  it('geocodifica una sugerencia seleccionada', () => {
    const { fixture, mapsApi } = setup();
    fixture.componentInstance.seleccionarSugerencia({ descripcion: 'Calle 15, Caobos', placeId: 'p1' });
    expect(mapsApi.geocodificar).toHaveBeenCalledWith('Calle 15, Caobos');
    expect(fixture.componentInstance.solicitudForm.controls.direccion.value).toBe('Calle 15, Caobos');
    expect(fixture.componentInstance.barrioSeleccionado()).toBe('');
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
});
