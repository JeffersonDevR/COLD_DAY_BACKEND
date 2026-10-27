import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { cargarOtDesdeRuta, otDesdeFuente } from './ot-carga';
import { ApiHttpError } from '../interceptos/error.interceptor';
import { ApiConfig } from './api.config';
import { MockDbService } from './mock-db.service';
import { OtApi } from './ot-api';
import { OtResponse } from '../models/common.models';

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

  it('cargarOtDesdeRuta expone el fallo de la carga con copy humana', () => {
    const route = { paramMap: of(convertToParamMap({ id: 'ot1' })) } as unknown as ActivatedRoute;
    const otApi = {
      getOtById: vi.fn(() => throwError(() => new ApiHttpError('boom', 500))),
    } as unknown as OtApi;

    const estado = cargarOtDesdeRuta(route, otApi, () => undefined, () => undefined);

    expect(estado.error()).toBe('Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.');
  });

  it('cargarOtDesdeRuta reintenta el último id y limpia el error', () => {
    const route = { paramMap: of(convertToParamMap({ id: 'ot1' })) } as unknown as ActivatedRoute;
    const getOtById = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiHttpError('boom', 500)))
      .mockReturnValueOnce(of(ot));
    const otApi = { getOtById } as unknown as OtApi;
    let recibida: OtResponse | undefined;

    const estado = cargarOtDesdeRuta(route, otApi, () => undefined, (o) => (recibida = o));

    expect(estado.error()).not.toBeNull();
    estado.reintentar();

    expect(estado.error()).toBeNull();
    expect(recibida).toBe(ot);
    expect(getOtById).toHaveBeenCalledTimes(2);
    expect(getOtById).toHaveBeenLastCalledWith('ot1');
  });
});
