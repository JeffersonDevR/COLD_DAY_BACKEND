import { firstValueFrom } from 'rxjs';
import { pendienteBackend } from './pendiente-backend';

describe('pendienteBackend', () => {
  it('emite un error uniforme de pendiente backend', async () => {
    await expect(firstValueFrom(pendienteBackend('POST /api/x'))).rejects.toThrow(
      'Pendiente en el backend: POST /api/x. Pendiente(backend).',
    );
  });
});
