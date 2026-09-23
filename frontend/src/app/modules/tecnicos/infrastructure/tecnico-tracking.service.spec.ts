import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TecnicoTrackingService } from './tecnico-tracking.service';
import { GeolocationService } from '../../../core/shared/infrastructure/geolocation/geolocation.service';
import { TecnicosApi } from './tecnicos-api';
import { Point } from '../../../core/shared/domain/models/common.models';

describe('TecnicoTrackingService', () => {
  let posiciones: Subject<Point>;
  let disponible: boolean;
  let vigilarPosicion: ReturnType<typeof vi.fn>;
  let actualizarUbicacion: ReturnType<typeof vi.fn>;

  function setup() {
    posiciones = new Subject<Point>();
    vigilarPosicion = vi.fn(() => posiciones.asObservable());
    actualizarUbicacion = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: GeolocationService, useValue: { get disponible() { return disponible; }, vigilarPosicion } },
        { provide: TecnicosApi, useValue: { actualizarUbicacion } },
      ],
    });
    return TestBed.inject(TecnicoTrackingService);
  }

  beforeEach(() => {
    disponible = true;
  });

  it('no inicia si la geolocalización no está disponible', () => {
    disponible = false;
    const service = setup();
    service.iniciar();
    expect(vigilarPosicion).not.toHaveBeenCalled();
    expect(service.activo()).toBe(false);
  });

  it('publica la ubicación al recibir una posición', () => {
    const service = setup();
    service.iniciar();
    expect(service.activo()).toBe(true);

    posiciones.next({ latitud: 7.89, longitud: -72.5 });

    expect(service.ultimaPosicion()).toEqual({ latitud: 7.89, longitud: -72.5 });
    expect(actualizarUbicacion).toHaveBeenCalledWith({ latitud: 7.89, longitud: -72.5 });
  });

  it('ignora un segundo inicio mientras está activo', () => {
    const service = setup();
    service.iniciar();
    service.iniciar();
    expect(vigilarPosicion).toHaveBeenCalledTimes(1);
  });

  it('detener cancela la suscripción y baja la bandera', () => {
    const service = setup();
    service.iniciar();
    service.detener();
    expect(service.activo()).toBe(false);
    expect(posiciones.observers.length).toBe(0);
  });

  it('se detiene si el observable de posición emite error', () => {
    const service = setup();
    service.iniciar();
    posiciones.error(new Error('sin gps'));
    expect(service.activo()).toBe(false);
  });

  it('no propaga errores de actualizarUbicacion', () => {
    actualizarUbicacion = vi.fn(() => throwError(() => new Error('sin red')));
    const service = setup();
    service.iniciar();
    expect(() => posiciones.next({ latitud: 1, longitud: 2 })).not.toThrow();
    expect(service.ultimaPosicion()).toEqual({ latitud: 1, longitud: 2 });
  });
});
