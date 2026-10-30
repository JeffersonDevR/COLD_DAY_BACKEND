import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { TecnicoPresenciaService, CLAVE_COMPARTIR_UBICACION } from './tecnico-presencia.service';
import { TecnicoTrackingService } from './tecnico-tracking.service';
import { GeolocationService } from './geolocation.service';
import { TecnicosApi } from './tecnicos-api';
import { EstadoOt, OtResponse, Point } from '../models/common.models';

function ot(estado: EstadoOt, id = 'ot-1'): OtResponse {
  return {
    id,
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'x',
    estado,
    auxiliaresRequeridos: 0,
  };
}

describe('TecnicoPresenciaService', () => {
  let posiciones: Subject<Point>;
  let vigilarPosicion: ReturnType<typeof vi.fn>;
  let actualizarUbicacion: ReturnType<typeof vi.fn>;
  let tracking: TecnicoTrackingService;
  let service: TecnicoPresenciaService;

  function setup(): TecnicoPresenciaService {
    posiciones = new Subject<Point>();
    vigilarPosicion = vi.fn(() => posiciones.asObservable());
    actualizarUbicacion = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: GeolocationService, useValue: { disponible: true, vigilarPosicion } },
        { provide: TecnicosApi, useValue: { actualizarUbicacion } },
      ],
    });
    // Tracking real: la política se prueba contra el servicio que de verdad
    // abre el watch, no contra un doble que siempre dice que sí.
    tracking = TestBed.inject(TecnicoTrackingService);
    service = TestBed.inject(TecnicoPresenciaService);
    return service;
  }

  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('reporta solo con una OT en movimiento, sin tocar el switch', () => {
    setup();

    service.sincronizarOts([ot('EN_CAMINO')]);

    expect(service.modo()).toBe('ejecutando');
    expect(service.reportando()).toBe(true);
    expect(service.compartirUbicacion()).toBe(false);
    expect(vigilarPosicion).toHaveBeenCalledTimes(1);
  });

  it('no enciende el GPS sin OT activa y con el switch apagado', () => {
    setup();

    service.sincronizarOts([]);

    expect(service.modo()).toBe('apagada');
    expect(service.reportando()).toBe(false);
    expect(vigilarPosicion).not.toHaveBeenCalled();
    expect(CLAVE_COMPARTIR_UBICACION in window.localStorage).toBe(false);
  });

  it('reporta en modo disponible cuando el switch está encendido', () => {
    setup();

    service.activar();
    service.sincronizarOts([]);

    expect(service.modo()).toBe('compartiendo');
    expect(service.reportando()).toBe(true);
    expect(vigilarPosicion).toHaveBeenCalledTimes(1);
  });

  it('respeta la preferencia guardada al arrancar la app', () => {
    window.localStorage.setItem(CLAVE_COMPARTIR_UBICACION, 'true');

    setup();
    service.sincronizarOts([]);

    expect(service.compartirUbicacion()).toBe(true);
    expect(service.modo()).toBe('compartiendo');
    expect(vigilarPosicion).toHaveBeenCalledTimes(1);
  });

  it('persiste el switch para el próximo refresh', () => {
    setup();

    service.activar();
    expect(window.localStorage.getItem(CLAVE_COMPARTIR_UBICACION)).toBe('true');

    service.desactivar();
    expect(window.localStorage.getItem(CLAVE_COMPARTIR_UBICACION)).toBe('false');
    expect(tracking.activo()).toBe(false);
  });

  it('detiene el reporte al cerrar la última OT', () => {
    setup();
    service.sincronizarOts([ot('EN_REPARACION')]);
    expect(tracking.activo()).toBe(true);

    service.sincronizarOts([ot('FINALIZADA')]);

    expect(service.modo()).toBe('apagada');
    expect(tracking.activo()).toBe(false);
    expect(posiciones.observers.length).toBe(0);
  });

  it('detiene el reporte al salir de la ejecución con el switch apagado', () => {
    setup();
    service.sincronizarOt(ot('EN_CAMINO'));
    expect(tracking.activo()).toBe(true);

    service.liberarContexto();

    expect(service.modo()).toBe('apagada');
    expect(tracking.activo()).toBe(false);
  });

  it('mantiene el reporte al salir de la ejecución si el switch está encendido', () => {
    setup();
    service.sincronizarOt(ot('EN_CAMINO'));

    service.activar();
    service.liberarContexto();

    expect(service.modo()).toBe('compartiendo');
    expect(tracking.activo()).toBe(true);
  });

  it('bloquea el switch mientras hay una OT en curso', () => {
    setup();
    service.sincronizarOts([ot('EN_DIAGNOSTICO')]);

    expect(service.switchBloqueado()).toBe(true);

    // Aunque el técnico lo apague, la política sigue reportando por la OT.
    service.desactivar();

    expect(service.modo()).toBe('ejecutando');
    expect(tracking.activo()).toBe(true);
  });

  it('no duplica suscripciones cuando la política corre varias veces', () => {
    setup();
    const activa = [ot('EN_CAMINO')];

    service.sincronizarOts(activa);
    service.sincronizarOts(activa);
    service.sincronizarOt(ot('EN_CAMINO'));
    service.reintentar();

    expect(vigilarPosicion).toHaveBeenCalledTimes(1);
    expect(posiciones.observers.length).toBe(1);
  });

  it('expone la causa cuando el GPS rechaza el permiso', () => {
    setup();
    service.activar();

    posiciones.error({ code: 1, message: 'User denied Geolocation' });

    expect(service.motivo()).toBe(
      'Permiso de ubicación denegado. Habilítalo en el navegador para continuar.',
    );
    expect(service.reportando()).toBe(false);
    // La preferencia no se pierde: el técnico puede reintentar cuando la habilite.
    expect(service.compartirUbicacion()).toBe(true);
  });
});
