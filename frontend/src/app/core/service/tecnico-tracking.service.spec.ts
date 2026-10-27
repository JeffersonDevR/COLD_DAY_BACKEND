import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TecnicoTrackingService } from './tecnico-tracking.service';
import { GeolocationService } from './geolocation.service';
import { TecnicosApi } from './tecnicos-api';
import { Point } from '../models/common.models';

/**
 * jsdom expone `document.visibilityState` como getter de solo lectura sobre el
 * prototipo; el doble lo redefine como propiedad propia para poder alternar
 * entre visible y oculta igual que lo haría el navegador.
 */
function simularVisibilidad(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => estado,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

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

  it('expone el motivo cuando la geolocalización no está disponible', () => {
    disponible = false;
    const service = setup();
    service.iniciar();
    expect(service.motivo()).toBe('La geolocalización no está disponible en este navegador.');
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

  it('conserva la causa del GPS: un timeout no se reporta como falta de permiso', () => {
    const service = setup();
    service.iniciar();
    // Lo que `vigilarPosicion` emite de verdad: un `Error` con la causa ya
    // traducida. El timeout no puede leerse como falta de permiso.
    posiciones.error(new Error('Se agotó el tiempo para obtener la ubicación.'));
    expect(service.activo()).toBe(false);
    expect(service.motivo()).toBe('Se agotó el tiempo para obtener la ubicación.');
  });

  it('traduce el permiso denegado a su causa específica', () => {
    const service = setup();
    service.iniciar();
    posiciones.error({ code: 1, message: 'User denied Geolocation' });
    expect(service.motivo()).toBe(
      'Permiso de ubicación denegado. Habilítalo en el navegador para continuar.',
    );
  });

  it('usa un fallback neutro cuando el error no trae una causa reconocible', () => {
    const service = setup();
    service.iniciar();
    posiciones.error(new Error('sin gps'));
    expect(service.motivo()).toBe('No se pudo obtener la ubicación.');
  });

  it('limpia el motivo al recibir una posición válida', () => {
    const service = setup();
    service.iniciar();
    posiciones.error({ code: 2, message: 'Position unavailable' });
    expect(service.motivo()).toBe('La ubicación no está disponible en este momento.');

    // Un reintento exitoso no debe arrastrar el motivo anterior.
    posiciones = new Subject<Point>();
    service.iniciar();
    expect(service.motivo()).toBeNull();

    posiciones.next({ latitud: 3, longitud: 4 });
    expect(service.motivo()).toBeNull();
  });

  it('detener de forma intencional limpia el motivo', () => {
    const service = setup();
    service.iniciar();
    service.detener();
    expect(service.activo()).toBe(false);
    expect(service.motivo()).toBeNull();
  });

  it('no propaga errores de actualizarUbicacion', () => {
    actualizarUbicacion = vi.fn(() => throwError(() => new Error('sin red')));
    const service = setup();
    service.iniciar();
    expect(() => posiciones.next({ latitud: 1, longitud: 2 })).not.toThrow();
    expect(service.ultimaPosicion()).toEqual({ latitud: 1, longitud: 2 });
  });

  describe('gate por visibilidad de la pestaña', () => {
    afterEach(() => {
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('no enciende el GPS con la pestaña oculta y lo reanuda al volver', () => {
      simularVisibilidad('hidden');
      const service = setup();
      service.iniciar();

      expect(vigilarPosicion).not.toHaveBeenCalled();

      simularVisibilidad('visible');
      expect(vigilarPosicion).toHaveBeenCalledTimes(1);

      posiciones.next({ latitud: 3, longitud: 4 });
      expect(actualizarUbicacion).toHaveBeenCalledWith({ latitud: 3, longitud: 4 });
    });

    it('corta el watch al ocultar la pestaña (no sigue reportando a ciegas)', () => {
      simularVisibilidad('visible');
      const service = setup();
      service.iniciar();
      expect(posiciones.observers.length).toBe(1);

      simularVisibilidad('hidden');

      expect(posiciones.observers.length).toBe(0);
      expect(service.activo()).toBe(true);
      expect(service.motivo()).toBeNull();
    });
  });
});
