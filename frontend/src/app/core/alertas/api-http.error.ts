/**
 * Error normalizado para la UI. Conserva el status HTTP y los `fieldErrors`
 * del backend para que las páginas puedan mostrar mensajes útiles.
 *
 * Vive fuera de `interceptos/error.interceptor` para que los módulos que solo
 * necesitan el tipo (copy de errores, mocks, mobile) no arrastren la fachada de
 * toasts de PrimeNG al grafo de imports.
 */
export class ApiHttpError extends Error {
  /**
   * `true` cuando el interceptor ya avisó del fallo y cerró la sesión. Las
   * páginas lo consultan para no repetir el mismo aviso al usuario.
   */
  sesionNotificada = false;

  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: string[] = [],
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}
