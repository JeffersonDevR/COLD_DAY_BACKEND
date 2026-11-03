import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { AVISO_SESION } from '@core/alertas/aviso-sesion';
import { MobileToastService, provideAvisoSesion } from './toast.service';

function toastController(opts: { falla?: boolean } = {}) {
  const present = vi.fn().mockResolvedValue(undefined);
  const create = opts.falla
    ? vi.fn().mockRejectedValue(new Error('sin overlays'))
    : vi.fn().mockResolvedValue({ present });
  return { create, present };
}

function setup(controller: ReturnType<typeof toastController>, providers: unknown[] = []) {
  TestBed.configureTestingModule({
    providers: [{ provide: ToastController, useValue: controller }, ...(providers as [])],
  });
}

describe('MobileToastService', () => {
  it('crea un ion-toast con header, mensaje y color del tipo', async () => {
    const controller = toastController();
    setup(controller);
    const toast = TestBed.inject(MobileToastService);

    await toast.error('Error del servidor', 'Ocurrió un error.');

    expect(controller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Error del servidor',
        message: 'Ocurrió un error.',
        color: 'danger',
      }),
    );
    expect(controller.present).toHaveBeenCalledTimes(1);
  });

  it('usa el color de advertencia para los avisos de sesión', async () => {
    const controller = toastController();
    setup(controller);
    const toast = TestBed.inject(MobileToastService);

    await toast.warning('Tu sesión expiró', 'Ingresá de nuevo.');

    expect(controller.create).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning', position: 'top' }),
    );
  });

  it('nunca rechaza cuando el overlay no se puede mostrar', async () => {
    const controller = toastController({ falla: true });
    setup(controller);
    const toast = TestBed.inject(MobileToastService);

    await expect(toast.success('Listo')).resolves.toBeUndefined();
    expect(controller.create).toHaveBeenCalledTimes(1);
  });

  it('provideAvisoSesion delega el aviso de sesión en el toast de Ionic', async () => {
    const controller = toastController();
    setup(controller, [provideAvisoSesion()]);
    const aviso = TestBed.inject(AVISO_SESION);

    aviso.advertir('Sesión expirada', 'Tu sesión caducó. Inicia sesión de nuevo para continuar.');

    expect(controller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Sesión expirada',
        message: 'Tu sesión caducó. Inicia sesión de nuevo para continuar.',
        color: 'warning',
      }),
    );
  });
});
