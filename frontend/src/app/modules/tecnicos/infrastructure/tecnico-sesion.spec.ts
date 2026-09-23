import { of, throwError } from 'rxjs';
import { cargarTecnicoAutenticado } from './tecnico-sesion';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from './tecnicos-api';
import { TecnicoResponse } from '../../../core/shared/domain/models/common.models';

const tecnico: TecnicoResponse = { id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co' };

describe('cargarTecnicoAutenticado', () => {
  it('resuelve el técnico por el usuarioId del JWT', () => {
    const auth = { currentUser: () => ({ id: 6 }) } as unknown as AuthService;
    const tecnicosApi = { getTecnicoPorUsuarioId: vi.fn(() => of(tecnico)) } as unknown as TecnicosApi;
    let recibido: TecnicoResponse | undefined;

    cargarTecnicoAutenticado(auth, tecnicosApi, (t) => (recibido = t));

    expect(tecnicosApi.getTecnicoPorUsuarioId).toHaveBeenCalledWith(6);
    expect(recibido).toBe(tecnico);
  });

  it('ante error entrega undefined y notifica onError', () => {
    const auth = { currentUser: () => null } as unknown as AuthService;
    const tecnicosApi = {
      getTecnicoPorUsuarioId: vi.fn(() => throwError(() => new Error('sin red'))),
    } as unknown as TecnicosApi;
    let recibido: TecnicoResponse | undefined = tecnico;
    let errored = false;

    cargarTecnicoAutenticado(auth, tecnicosApi, (t) => (recibido = t), () => (errored = true));

    expect(tecnicosApi.getTecnicoPorUsuarioId).toHaveBeenCalledWith(0);
    expect(recibido).toBeUndefined();
    expect(errored).toBe(true);
  });
});
