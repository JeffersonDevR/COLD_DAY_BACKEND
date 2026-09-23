import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { calcularRuta, cargarOtDesdeRuta, otDesdeFuente } from './ot-carga';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { OtApi } from './ot-api';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const ot: OtResponse = {
  id: 'ot1', categoriaServicio: 'REFRIGERACION', descripcionFalla: 'x', estado: 'EN_CAMINO', auxiliaresRequeridos: 0,
};

describe('ot-carga', () => {
  it('otDesdeFuente lee del MockDb en modo mock', () => {
    const apiConfig = { useMocks: () => true } as unknown as ApiConfig;
    const mockDb = { ordenesTrabajo: () => [ot] } as unknown as MockDbService;
    const result = otDesdeFuente(apiConfig, mockDb, signal('ot1'), signal<OtResponse | undefined>(undefined));
    expect(result()).toBe(ot);
  });

  it('otDesdeFuente usa la OT remota contra el backend', () => {
    const apiConfig = { useMocks: () => false } as unknown as ApiConfig;
    const mockDb = { ordenesTrabajo: () => [] } as unknown as MockDbService;
    const result = otDesdeFuente(apiConfig, mockDb, signal('ot1'), signal<OtResponse | undefined>(ot));
    expect(result()).toBe(ot);
  });

  it('cargarOtDesdeRuta propaga el id y la OT', () => {
    const route = { paramMap: of(convertToParamMap({ id: 'ot1' })) } as unknown as ActivatedRoute;
    const otApi = { getOtById: vi.fn(() => of(ot)) } as unknown as OtApi;
    let id = '';
    let recibida: OtResponse | undefined;

    cargarOtDesdeRuta(route, otApi, (v) => (id = v), (o) => (recibida = o));

    expect(id).toBe('ot1');
    expect(recibida).toBe(ot);
  });

  it('cargarOtDesdeRuta ignora rutas sin id', () => {
    const route = { paramMap: of(convertToParamMap({})) } as unknown as ActivatedRoute;
    const otApi = { getOtById: vi.fn() } as unknown as OtApi;
    let llamado = false;

    cargarOtDesdeRuta(route, otApi, () => (llamado = true), () => (llamado = true));

    expect(llamado).toBe(false);
    expect(otApi.getOtById).not.toHaveBeenCalled();
  });

  it('calcularRuta emite distancia y ETA', () => {
    const mapsApi = {
      distancia: vi.fn(() => of({ distanciaKm: 3, duracionMin: 8, distanciaTexto: '', duracionTexto: '' })),
    } as unknown as MapsApi;
    let ruta: { distanciaKm: number; duracionMin: number } | undefined;

    calcularRuta(mapsApi, { latitud: 1, longitud: 2 }, { latitud: 3, longitud: 4 }, (r) => (ruta = r));

    expect(ruta).toMatchObject({ distanciaKm: 3, duracionMin: 8 });
  });

  it('calcularRuta no consulta sin origen o destino', () => {
    const mapsApi = { distancia: vi.fn() } as unknown as MapsApi;

    calcularRuta(mapsApi, null, { latitud: 3, longitud: 4 }, () => undefined);
    calcularRuta(mapsApi, { latitud: 1, longitud: 2 }, undefined, () => undefined);

    expect(mapsApi.distancia).not.toHaveBeenCalled();
  });

  it('calcularRuta invoca onError', () => {
    const mapsApi = { distancia: vi.fn(() => throwError(() => new Error('503'))) } as unknown as MapsApi;
    let errored = false;

    calcularRuta(
      mapsApi,
      { latitud: 1, longitud: 2 },
      { latitud: 3, longitud: 4 },
      () => undefined,
      () => (errored = true),
    );

    expect(errored).toBe(true);
  });
});
