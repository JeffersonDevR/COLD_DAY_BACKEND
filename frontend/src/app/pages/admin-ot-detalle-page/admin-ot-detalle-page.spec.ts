import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminOtDetallePage } from './admin-ot-detalle-page';
import { OtApi } from '../../core/service/ot-api';
import { ApiHttpError } from '../../core/alertas/api-http.error';
import { OtResponse } from '../../core/models/common.models';
import { OtApiResponse } from '../../core/models/backend.dto';
import { aOtResponse } from '../../core/service/backend.mappers';

const completa: OtResponse = {
  id: 'ot-1',
  codigo: 'OT-2026-0001',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'No enfría',
  estado: 'EN_REPARACION',
  clienteNombre: 'Ana Cliente',
  tecnicoNombre: 'Luis Técnico',
  barrio: 'Caobos',
  presupuesto: { aprobado: true, total: 150000, manoObra: 100000, repuestos: 50000 },
  auxiliaresRequeridos: 0,
};

function setup(
  getOtById: () => Observable<OtResponse>,
  getHistorial: () => Observable<unknown[]> = () => of([]),
) {
  const otApi = { getOtById: vi.fn(getOtById), getHistorial: vi.fn(getHistorial) };
  TestBed.configureTestingModule({
    imports: [AdminOtDetallePage],
    providers: [
      provideRouter([]),
      { provide: OtApi, useValue: otApi },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot-1' })) } },
    ],
  });
  const fixture = TestBed.createComponent(AdminOtDetallePage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, otApi, texto: () => el.textContent ?? '' };
}

describe('AdminOtDetallePage', () => {
  it('muestra código, cliente, técnico, descripción y total', () => {
    const { texto, otApi } = setup(() => of(completa));

    for (const t of ['OT-2026-0001', 'Ana Cliente', 'Luis Técnico', 'No enfría', '150.000']) {
      expect(texto()).toContain(t);
    }
    expect(otApi.getOtById).toHaveBeenCalledWith('ot-1');
    expect(otApi.getHistorial).toHaveBeenCalledWith('ot-1');
  });

  it('sin técnico ni presupuesto lo dice', () => {
    const { texto } = setup(() =>
      of({ ...completa, tecnicoNombre: undefined, presupuesto: undefined }),
    );

    expect(texto()).toContain('Sin técnico asignado');
    expect(texto()).toContain('Sin presupuesto');
    expect(texto()).not.toContain('undefined');
  });

  it('si la OT responde 403 muestra el aviso con reintento', () => {
    const { el, fixture, otApi } = setup(() =>
      throwError(() => new ApiHttpError('Sin permiso', 403)),
    );

    expect(el.querySelector('app-carga-error')).not.toBeNull();
    (el.querySelector('app-carga-error button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(otApi.getOtById).toHaveBeenCalledTimes(2);
  });

  it('si falla solo el historial, igual muestra la OT', () => {
    const { texto } = setup(
      () => of(completa),
      () => throwError(() => new Error('sin red')),
    );

    expect(texto()).toContain('OT-2026-0001');
    expect(texto()).toContain('No pudimos cargar el historial.');
  });

  it('no afirma que el presupuesto esté sin aprobar: la API no lo informa', () => {
    const real = aOtResponse({
      id: 'ot-1',
      estado: 'EN_REPARACION',
      categoriaServicio: 'REFRIGERACION',
      descripcionFalla: 'No enfría',
      presupuesto: { costoManoObra: 100000, costoRepuestos: 50000 },
      latitud: null,
      longitud: null,
      auxiliaresRequeridos: 0,
    } as unknown as OtApiResponse);
    const { texto } = setup(() => of(real));

    expect(texto()).toContain('150.000');
    expect(texto()).not.toContain('Aprobado');
  });

  it('muestra la tarifa de visita registrada y si está pagada', () => {
    const { texto } = setup(() => of({ ...completa, tarifaVisita: 30000, visitaPagada: true }));

    expect(texto()).toContain('Tarifa de visita');
    expect(texto()).toContain('30.000');
    expect(texto()).toContain('Pagada');
  });

  it('no ofrece acciones sobre la OT', () => {
    const { el } = setup(() => of(completa));

    expect(el.querySelectorAll('form, input, textarea, button').length).toBe(0);
  });
});
