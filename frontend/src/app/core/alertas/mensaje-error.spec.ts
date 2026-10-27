import { ApiHttpError } from '../interceptos/error.interceptor';
import { avisarErrorAccion, mensajeErrorAccion, sesionYaNotificada } from './mensaje-error';

describe('mensajeErrorAccion', () => {
  it('traduce cada status conocido a copy humana en español', () => {
    expect(mensajeErrorAccion(new ApiHttpError('interno', 403))).toContain('permisos');
    expect(mensajeErrorAccion(new ApiHttpError('interno', 404))).toContain('No encontramos el registro');
    expect(mensajeErrorAccion(new ApiHttpError('interno', 409))).toContain('cambió de estado');
    expect(mensajeErrorAccion(new ApiHttpError('interno', 0))).toContain('conectar con el servidor');
  });

  it('usa el mensaje del status y nunca el mensaje interno del backend', () => {
    const err = new ApiHttpError('Documentacion incompleta o vencida del técnico TEC-1', 409);
    const mensaje = mensajeErrorAccion(err);
    expect(mensaje).not.toContain('TEC-1');
    expect(mensaje).not.toContain('Documentacion incompleta');
    expect(mensaje).not.toContain('409');
  });

  it('permite sobrescribir el copy de un status concreto', () => {
    const err = new ApiHttpError('interno', 409);
    const mensaje = mensajeErrorAccion(err, { 409: 'El expediente está vencido.' });
    expect(mensaje).toBe('El expediente está vencido.');
  });

  it('cae al mensaje inesperado ante un status desconocido', () => {
    const mensaje = mensajeErrorAccion(new ApiHttpError('interno', 418));
    expect(mensaje).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  });

  it('cae al mensaje inesperado ante un fallo que no es HTTP', () => {
    expect(mensajeErrorAccion(new Error('boom'))).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
    expect(mensajeErrorAccion(null)).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  });

  it('ignora una sobrescritura para un status que no coincide', () => {
    const mensaje = mensajeErrorAccion(new ApiHttpError('interno', 404), { 409: 'no aplica' });
    expect(mensaje).toContain('No encontramos el registro');
  });
});

describe('avisarErrorAccion', () => {
  function toastFalso() {
    return { error: vi.fn() };
  }

  it('avisa una sola vez con la copy del status', () => {
    const toast = toastFalso();
    avisarErrorAccion(toast, 'No se pudo calificar', new ApiHttpError('interno', 409));
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo calificar',
      'La operación no se pudo completar porque el registro cambió de estado. Actualiza la página e inténtalo de nuevo.',
    );
  });

  it('respeta la copy propia de la pantalla', () => {
    const toast = toastFalso();
    avisarErrorAccion(toast, 'No se pudo calificar', new ApiHttpError('interno', 409), {
      409: 'Ya calificaste esta orden.',
    });
    expect(toast.error).toHaveBeenCalledWith('No se pudo calificar', 'Ya calificaste esta orden.');
  });

  it('no repite el aviso cuando el interceptor ya notificó el 401', () => {
    const err = new ApiHttpError('Sesión inválida o expirada. Inicia sesión de nuevo.', 401);
    err.sesionNotificada = true;
    const toast = toastFalso();

    expect(sesionYaNotificada(err)).toBe(true);
    avisarErrorAccion(toast, 'No se pudo calificar', err);

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('avisa un 401 que el interceptor no notificó (sin sesión activa)', () => {
    const toast = toastFalso();
    avisarErrorAccion(toast, 'No se pudo calificar', new ApiHttpError('interno', 401));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(sesionYaNotificada(new ApiHttpError('interno', 401))).toBe(false);
  });
});
