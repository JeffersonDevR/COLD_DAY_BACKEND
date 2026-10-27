import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DisputasAdminPage } from './disputas-admin-page';
import { AdminApi } from '../../core/service/admin-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { DisputaResponse } from '../../core/models/common.models';

const disputa: DisputaResponse = {
  id: 'DISP-1',
  otId: 'OT-1',
  otCodigo: 'OT-2026-0005',
  motivo: 'cobro excesivo',
  estado: 'ABIERTA',
  clienteNombre: 'Ana',
  tecnicoNombre: 'Juan',
};

function setup(getTodasDisputas?: ReturnType<typeof vi.fn>) {
  const adminApi = {
    getTodasDisputas: getTodasDisputas ?? vi.fn(() => of([disputa])),
    resolverDisputa: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [DisputasAdminPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: adminApi },
      { provide: AuthService, useValue: { currentUser: () => ({ nombre: 'Admin Uno' }) } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(DisputasAdminPage);
  fixture.detectChanges();
  return { fixture, adminApi, toast };
}

describe('DisputasAdminPage', () => {
  it('carga las disputas al iniciar', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.disputas().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('cobro excesivo');
  });

  it('avisa si las disputas no cargan y reintenta', () => {
    const getTodasDisputas = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of([disputa]));
    const { fixture } = setup(getTodasDisputas);

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las disputas.');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getTodasDisputas).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.disputas().length).toBe(1);
  });

  it('abre el modal de resolución', () => {
    const { fixture } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    expect(fixture.componentInstance.disputaSeleccionada()?.id).toBe('DISP-1');
  });

  it('identifica la disputa por el código de la OT, no por ids internos', () => {
    const { fixture } = setup();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('OT: OT-2026-0005');
    // Ni el id de la disputa ni el UUID de la OT se muestran.
    expect(texto).not.toContain('DISP-1');
    expect(texto).not.toContain('OT-1');

    fixture.componentInstance.abrirResolucion(disputa);
    fixture.detectChanges();
    const modal = fixture.nativeElement.textContent as string;
    expect(modal).toContain('Mediación Oficial: OT OT-2026-0005');
    expect(modal).not.toContain('Caso DISP-1');
  });

  it('resuelve la disputa con el dictamen y recarga', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    fixture.componentInstance.resolucionCtrl.setValue('Se acuerda un descuento del 10%');

    fixture.componentInstance.resolver(true);

    expect(adminApi.resolverDisputa).toHaveBeenCalledWith('DISP-1', 'Se acuerda un descuento del 10%', true, 'Admin Uno');
    expect(toast.success).toHaveBeenCalledWith(
      'Disputa Resuelta',
      'La disputa de la OT OT-2026-0005 ha sido conciliada satisfactoriamente.',
    );
    expect(fixture.componentInstance.disputaSeleccionada()).toBeNull();
  });

  it('sin código de OT, el aviso usa el fallback y no filtra el id interno', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.abrirResolucion({ ...disputa, otCodigo: undefined });
    fixture.componentInstance.resolucionCtrl.setValue('Se acuerda un descuento del 10%');

    fixture.componentInstance.resolver(true);

    expect(toast.success).toHaveBeenCalledWith('Disputa Resuelta', expect.stringContaining('Sin código'));
    expect(toast.success).not.toHaveBeenCalledWith('Disputa Resuelta', expect.stringContaining('DISP-1'));
  });

  it('no resuelve si el dictamen es inválido', () => {
    const { fixture, adminApi } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    fixture.componentInstance.resolucionCtrl.setValue('corto');

    fixture.componentInstance.resolver(true);

    expect(adminApi.resolverDisputa).not.toHaveBeenCalled();
  });

  it('avisa si falla la resolución y mantiene el modal con el dictamen', () => {
    const { fixture, adminApi, toast } = setup();
    adminApi.resolverDisputa.mockReturnValue(
      throwError(() => new ApiHttpError('La disputa ya fue resuelta', 409)),
    );
    fixture.componentInstance.abrirResolucion(disputa);
    fixture.componentInstance.resolucionCtrl.setValue('Se acuerda un descuento del 10%');

    fixture.componentInstance.resolver(true);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo resolver la disputa', expect.any(String));
    // El modal sigue abierto con el dictamen escrito para reintentar.
    expect(fixture.componentInstance.disputaSeleccionada()).not.toBeNull();
    expect(fixture.componentInstance.resolucionCtrl.value).toBe('Se acuerda un descuento del 10%');
    expect(adminApi.getTodasDisputas).toHaveBeenCalledTimes(1);
  });
});
