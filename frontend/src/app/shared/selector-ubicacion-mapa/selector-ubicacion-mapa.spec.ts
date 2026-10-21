import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SelectorUbicacionMapa } from './selector-ubicacion-mapa';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';
import { GeolocationService } from '../../core/service/geolocation.service';
import { ToastService } from '../../core/alertas/toast.service';
import { MapaConfigService } from '../../core/service/mapa-config.service';
import { signal } from '@angular/core';

function eventoMapa(lat: number, lng: number): google.maps.MapMouseEvent {
  return { latLng: { lat: () => lat, lng: () => lng } } as unknown as google.maps.MapMouseEvent;
}

function setup(opts: { disponible?: boolean } = {}) {
  const mapsLoader = {
    isLoaded: signal(false),
    isLoading: signal(false),
    loadError: signal<string | null>(null),
    init: vi.fn(),
  };
  const geolocation = {
    disponible: opts.disponible ?? true,
    obtenerPosicion: vi.fn(() => of({ latitud: 7.9, longitud: -72.49 })),
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  TestBed.configureTestingModule({
    imports: [SelectorUbicacionMapa],
    providers: [
      { provide: GoogleMapsLoaderService, useValue: mapsLoader },
      { provide: GeolocationService, useValue: geolocation },
      { provide: ToastService, useValue: toast },
      // La configuración del mapa la publica el backend (ver mapa-config.service).
      {
        provide: MapaConfigService,
        useValue: {
          centro: () => ({ lat: 7.8939, lng: -72.5078 }),
          bounds: () => ({ north: 8.08, south: 7.76, east: -72.41, west: -72.6 }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SelectorUbicacionMapa);
  fixture.detectChanges();
  return { fixture, mapsLoader, geolocation, toast };
}

describe('SelectorUbicacionMapa', () => {
  it('emite la coordenada al hacer click en el mapa', () => {
    const { fixture } = setup();
    const emitidas: { latitud: number; longitud: number }[] = [];
    fixture.componentInstance.ubicacionChange.subscribe((p) => emitidas.push(p));

    fixture.componentInstance.alClickearMapa(eventoMapa(7.9, -72.49));

    expect(emitidas).toEqual([{ latitud: 7.9, longitud: -72.49 }]);
  });

  it('emite la coordenada al soltar el pin arrastrado', () => {
    const { fixture } = setup();
    const emitidas: { latitud: number; longitud: number }[] = [];
    fixture.componentInstance.ubicacionChange.subscribe((p) => emitidas.push(p));

    fixture.componentInstance.alSoltarPin(eventoMapa(7.88, -72.5));

    expect(emitidas).toEqual([{ latitud: 7.88, longitud: -72.5 }]);
  });

  it('usa el GPS del dispositivo y emite la coordenada', () => {
    const { fixture, geolocation } = setup();
    const emitidas: { latitud: number; longitud: number }[] = [];
    fixture.componentInstance.ubicacionChange.subscribe((p) => emitidas.push(p));

    fixture.componentInstance.usarMiUbicacion();

    expect(geolocation.obtenerPosicion).toHaveBeenCalled();
    expect(emitidas).toEqual([{ latitud: 7.9, longitud: -72.49 }]);
    expect(fixture.componentInstance.resolviendoGps()).toBe(false);
  });

  it('avisa si la geolocalización no está disponible', () => {
    const { fixture, geolocation, toast } = setup({ disponible: false });
    fixture.componentInstance.usarMiUbicacion();
    expect(geolocation.obtenerPosicion).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No disponible', expect.any(String));
  });

  it('degrada al panel de respaldo cuando el mapa no está cargado', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Mapa no disponible');
    // El GPS sigue disponible aunque el mapa no renderice.
    expect(el.textContent).toContain('Usar mi ubicación GPS');
  });
});
