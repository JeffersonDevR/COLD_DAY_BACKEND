import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PanelClientePage } from './panel-cliente-page';
import { ClientesApi } from '../infrastructure/clientes-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot1',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function setup(getOts: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [PanelClientePage],
    providers: [
      provideRouter([]),
      { provide: ClientesApi, useValue: { getOtsPorCliente: getOts } },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3, nombre: 'María' }) } },
    ],
  });
  const fixture = TestBed.createComponent(PanelClientePage);
  fixture.detectChanges();
  return fixture;
}

describe('PanelClientePage', () => {
  it('separa servicios activos y finalizados', () => {
    const getOts = vi.fn(() =>
      of([
        ot({ id: 'a', estado: 'EN_CAMINO' }),
        ot({ id: 'b', estado: 'FINALIZADA' }),
        ot({ id: 'c', estado: 'CANCELADA' }),
      ]),
    );
    const fixture = setup(getOts);
    expect(fixture.componentInstance.serviciosActivos().length).toBe(1);
    expect(fixture.componentInstance.serviciosFinalizados().length).toBe(1);
    expect(getOts).toHaveBeenCalledWith('3');
  });

  it('deja la lista vacía si falla la carga', () => {
    const getOts = vi.fn(() => throwError(() => new Error('sin red')));
    const fixture = setup(getOts);
    expect(fixture.componentInstance.serviciosCliente()).toEqual([]);
  });

  it('muestra el estado vacío sin servicios activos', () => {
    const fixture = setup(vi.fn(() => of([])));
    expect(fixture.nativeElement.textContent).toContain('No tienes servicios en curso');
  });
});
