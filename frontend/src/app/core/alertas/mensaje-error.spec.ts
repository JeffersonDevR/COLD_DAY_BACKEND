import { ApiHttpError } from '../interceptos/error.interceptor';
import { mensajeErrorAccion } from './mensaje-error';

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
