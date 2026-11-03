import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  DISTANCIA_MIN_RUTA_M,
  ESTADOS_TECNICO_EN_MOVIMIENTO,
  INTERVALO_MIN_RUTA_MS,
  RutaSeguimientoService,
} from './ruta-seguimiento.service';
import { MapsApi } from './maps-api';
import { Point } from '../models/common.models';
import { RutaApi } from '../models/backend.dto';

const ORIGEN: Point = { latitud: 7.9, longitud: -72.5 };
const DESTINO: Point = { latitud: 7.88, longitud: -72.49 };

const RUTA: RutaApi = { distanciaKm: 2.5, duracionMin: 7, polyline: 'abc_polyline' };

const EN_CAMINO = { visible: true, estado: 'EN_CAMINO' as const };

/** ~222 m north of ORIGEN (0.002° of latitude). */
const LEJOS: Point = { latitud: 7.902, longitud: -72.5 };
/** ~55 m north of ORIGEN (0.0005° of latitude). */
const CERCA: Point = { latitud: 7.9005, longitud: -72.5 };

function setup(respuesta: () => Observable<RutaApi | null> = () => of(RUTA)) {
  const mapsApi = { ruta: vi.fn(respuesta) };
  TestBed.configureTestingModule({
    providers: [RutaSeguimientoService, { provide: MapsApi, useValue: mapsApi }],
  });
  return { servicio: TestBed.inject(RutaSeguimientoService), mapsApi };
}

describe('RutaSeguimientoService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pide una sola ruta por ventana de 60 s aunque el sondeo sea cada 15 s', () => {
    const { servicio, mapsApi } = setup();

    expect(servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).toBe(true);
    vi.advanceTimersByTime(15_000);
    expect(servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).toBe(false);
    vi.advanceTimersByTime(15_000);
    expect(servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).toBe(false);
    vi.advanceTimersByTime(15_000);
    expect(servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).toBe(false);

    expect(mapsApi.ruta).toHaveBeenCalledTimes(1);

    // Cumplida la ventana, el siguiente tick sí gasta una petición.
    vi.advanceTimersByTime(INTERVALO_MIN_RUTA_MS - 45_000);
    expect(servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).toBe(true);
    expect(mapsApi.ruta).toHaveBeenCalledTimes(2);
  });

  it('un movimiento de más de 200 m adelanta la petición dentro de la ventana', () => {
    const { servicio, mapsApi } = setup();

    servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO);
    vi.advanceTimersByTime(15_000);

    expect(servicio.actualizar(LEJOS, DESTINO, EN_CAMINO)).toBe(true);
    expect(mapsApi.ruta).toHaveBeenCalledTimes(2);
    expect(mapsApi.ruta).toHaveBeenLastCalledWith(LEJOS, DESTINO);
  });

  it('un movimiento de menos de 200 m no adelanta la petición', () => {
    const { servicio, mapsApi } = setup();

    servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO);
    vi.advanceTimersByTime(15_000);

    expect(servicio.actualizar(CERCA, DESTINO, EN_CAMINO)).toBe(false);
    expect(mapsApi.ruta).toHaveBeenCalledTimes(1);
    // El umbral está en metros, no en grados: documenta el valor real usado.
    expect(DISTANCIA_MIN_RUTA_M).toBe(200);
  });

  it('con la pestaña oculta no pide nada', () => {
    const { servicio, mapsApi } = setup();

    expect(servicio.actualizar(ORIGEN, DESTINO, { ...EN_CAMINO, visible: false })).toBe(false);
    expect(mapsApi.ruta).not.toHaveBeenCalled();
  });

  it('con la OT fuera de los estados en movimiento no pide nada', () => {
    const { servicio, mapsApi } = setup();

    expect(servicio.actualizar(ORIGEN, DESTINO, { visible: true, estado: 'FINALIZADA' })).toBe(false);
    expect(servicio.actualizar(ORIGEN, DESTINO, { visible: true, estado: undefined })).toBe(false);
    expect(mapsApi.ruta).not.toHaveBeenCalled();
  });

  it('sin posición o sin destino no pide nada', () => {
    const { servicio, mapsApi } = setup();

    expect(servicio.actualizar(null, DESTINO, EN_CAMINO)).toBe(false);
    expect(servicio.actualizar(ORIGEN, null, EN_CAMINO)).toBe(false);
    expect(mapsApi.ruta).not.toHaveBeenCalled();
  });

  it('mientras hay una petición en vuelo no lanza otra', () => {
    const pendiente = new Subject<RutaApi | null>();
    const { servicio, mapsApi } = setup(() => pendiente.asObservable());

    servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO);
    // Aunque pasen los 60 s, la respuesta anterior todavía no llegó.
    vi.advanceTimersByTime(INTERVALO_MIN_RUTA_MS);
    expect(servicio.actualizar(LEJOS, DESTINO, EN_CAMINO)).toBe(false);
    expect(mapsApi.ruta).toHaveBeenCalledTimes(1);

    pendiente.next(RUTA);
    pendiente.complete();
    expect(servicio.rutaCodificada()).toBe(RUTA.polyline);
  });

  it('detener cancela la petición en vuelo (nada sobrevive a la pantalla)', () => {
    const pendiente = new Subject<RutaApi | null>();
    const { servicio } = setup(() => pendiente.asObservable());

    servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO);
    servicio.detener();

    pendiente.next(RUTA);
    pendiente.complete();
    expect(servicio.rutaCodificada()).toBeNull();
  });

  it('una ruta sin geometría deja la línea recta', () => {
    const { servicio } = setup(() => of({ ...RUTA, polyline: '' }));

    servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO);

    expect(servicio.rutaCodificada()).toBeNull();
  });

  it('un fallo de la API deja la línea recta, sin romper la pantalla', () => {
    const { servicio } = setup(() => throwError(() => new Error('502')));

    expect(() => servicio.actualizar(ORIGEN, DESTINO, EN_CAMINO)).not.toThrow();
    expect(servicio.rutaCodificada()).toBeNull();
  });

  it('los estados en movimiento son los mismos que gobiernan el seguimiento', () => {
    expect(ESTADOS_TECNICO_EN_MOVIMIENTO).toEqual([
      'ASIGNADA',
      'EN_CAMINO',
      'EN_DIAGNOSTICO',
      'EN_REPARACION',
    ]);
  });
});
