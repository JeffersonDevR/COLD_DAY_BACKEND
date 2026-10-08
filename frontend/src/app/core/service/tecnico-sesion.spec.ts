import { of, throwError } from 'rxjs';
import { cargarTecnicoAutenticado } from './tecnico-sesion';
import { TecnicosApi } from './tecnicos-api';
import { TecnicoResponse } from '../models/common.models';

const tecnico: TecnicoResponse = { id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co' };

describe('cargarTecnicoAutenticado', () => {
  it('resuelve el técnico desde el token vía GET /api/tecnicos/me', () => {
    const tecnicosApi = { getMiPerfil: vi.fn(() => of(tecnico)) } as unknown as TecnicosApi;
    let recibido: TecnicoResponse | undefined;

    cargarTecnicoAutenticado(tecnicosApi, (t) => (recibido = t));

    expect(tecnicosApi.getMiPerfil).toHaveBeenCalled();
    expect(recibido).toBe(tecnico);
  });

  it('ante error entrega undefined y notifica onError', () => {
    const tecnicosApi = {
      getMiPerfil: vi.fn(() => throwError(() => new Error('sin red'))),
    } as unknown as TecnicosApi;
    let recibido: TecnicoResponse | undefined = tecnico;
    let errored = false;

    cargarTecnicoAutenticado(tecnicosApi, (t) => (recibido = t), () => (errored = true));

    expect(tecnicosApi.getMiPerfil).toHaveBeenCalled();
    expect(recibido).toBeUndefined();
    expect(errored).toBe(true);
  });
});
