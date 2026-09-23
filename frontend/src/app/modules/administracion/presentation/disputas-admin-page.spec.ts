import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DisputasAdminPage } from './disputas-admin-page';
import { AdminApi } from '../infrastructure/admin-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { DisputaResponse } from '../../../core/shared/domain/models/common.models';

const disputa: DisputaResponse = {
  id: 'DISP-1',
  otId: 'OT-1',
  motivo: 'cobro excesivo',
  estado: 'ABIERTA',
  clienteNombre: 'Ana',
  tecnicoNombre: 'Juan',
};

function setup() {
  const adminApi = {
    getTodasDisputas: vi.fn(() => of([disputa])),
    resolverDisputa: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn() };
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

  it('abre el modal de resolución', () => {
    const { fixture } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    expect(fixture.componentInstance.disputaSeleccionada()?.id).toBe('DISP-1');
  });

  it('resuelve la disputa con el dictamen y recarga', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    fixture.componentInstance.resolucionCtrl.setValue('Se acuerda un descuento del 10%');

    fixture.componentInstance.resolver(true);

    expect(adminApi.resolverDisputa).toHaveBeenCalledWith('DISP-1', 'Se acuerda un descuento del 10%', true, 'Admin Uno');
    expect(toast.success).toHaveBeenCalled();
    expect(fixture.componentInstance.disputaSeleccionada()).toBeNull();
  });

  it('no resuelve si el dictamen es inválido', () => {
    const { fixture, adminApi } = setup();
    fixture.componentInstance.abrirResolucion(disputa);
    fixture.componentInstance.resolucionCtrl.setValue('corto');

    fixture.componentInstance.resolver(true);

    expect(adminApi.resolverDisputa).not.toHaveBeenCalled();
  });
});
