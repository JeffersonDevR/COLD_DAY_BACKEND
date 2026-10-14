import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SolicitarServicioPage } from './solicitar-servicio-page';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { MapsApi } from '../../core/service/maps-api';
import { OtResponse } from '../../core/models/common.models';

const nuevaOt: OtResponse = {
  id: 'OT-99',
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
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SolicitarServicioPage);
  fixture.detectChanges();
  return { fixture, clientesApi, mapsApi, toast, navigate };
}

/** Deja el formulario válido con una ubicación ya fijada en el mapa. */
function prepararFormularioListo(fixture: { componentInstance: SolicitarServicioPage }) {
  const c = fixture.componentInstance;
  c.alFijarEnMapa({ latitud: 7.9, longitud: -72.49 });
  c.solicitudForm.controls.descripcionFalla.setValue('El aire mini-split no enfría y gotea agua.');
}

describe('SolicitarServicioPage', () => {
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
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'OT-99']);
    expect(fixture.componentInstance.loading()).toBe(false);
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
    clientesApi.crearOt.mockReturnValue(throwError(() => new Error('500')));
    fixture.componentInstance.onSubmit();
    expect(toast.error).toHaveBeenCalledWith('No se pudo crear la solicitud', '500');
  });
});
