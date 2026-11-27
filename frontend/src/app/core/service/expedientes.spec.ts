import { of, throwError } from 'rxjs';
import { crearExpedientes } from './expedientes';

describe('crearExpedientes', () => {
  it('si falla una recarga conserva lo que se ve y lo marca como desactualizado', () => {
    const pedir = vi.fn()
      .mockReturnValueOnce(of(['cedula']))
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValue(of(['cedula', 'rut']));
    const expedientes = crearExpedientes<string>(pedir);

    expedientes.cargar('1');
    expedientes.cargar('1');
    expect(expedientes.porId()['1']).toEqual({ estado: 'listo', documentos: ['cedula'], desactualizado: true });

    expedientes.cargar('1');
    expect(expedientes.porId()['1']).toEqual({ estado: 'listo', documentos: ['cedula', 'rut'] });
  });

  it('si falla la primera carga queda en error', () => {
    const expedientes = crearExpedientes<string>(() => throwError(() => new Error('sin red')));

    expedientes.cargar('1');

    expect(expedientes.porId()['1']).toEqual({ estado: 'error' });
  });
});
