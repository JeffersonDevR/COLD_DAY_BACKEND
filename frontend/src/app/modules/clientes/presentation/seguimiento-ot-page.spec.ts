import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SeguimientoOtPage } from './seguimiento-ot-page';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { TecnicosApi } from '../../tecnicos/infrastructure/tecnicos-api';
import { MapsApi } from '../../../core/shared/infrastructure/maps/maps-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  estado: 'EN_CAMINO',
  auxiliaresRequeridos: 0,
  tecnicoId: 'TEC-1',
  tecnicoNombre: 'Juan',
  tecnicoTelefono: '300',
  punto: { latitud: 7.88, longitud: -72.49 },
  radioBusquedaKm: 10,
};

function setup(ot: OtResponse = orden) {
  const clientesApi = {
    cancelarOt: vi.fn(() => of(undefined)),
    abrirDisputa: vi.fn(() => of({ id: 'd1' })),
  };
  const otApi = {
    getOtById: vi.fn(() => of(ot)),
    getTecnicoUbicacion: vi.fn(() => of({ latitud: 7.9, longitud: -72.5 })),
    estimarTarifa: vi.fn(() => of({
      distanciaKm: 3.2,
      tarifaFuente: 'LINEAL' as const,
      banda: 0,
      tarifa: 30000,
      fueraDeRango: false,
    })),
  };
  const tecnicosApi = { getTecnicosCercanos: vi.fn(() => of([])) };
  const mapsApi = {
    distancia: vi.fn(() => of({ distanciaKm: 3.2, duracionMin: 8, distanciaTexto: '3.2 km', duracionTexto: '8 min' })),
  };
  const toast = { info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [SeguimientoOtPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: ClientesApi, useValue: clientesApi },
      { provide: OtApi, useValue: otApi },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: MapsApi, useValue: mapsApi },
      { provide: ApiConfig, useValue: { useMocks: () => false } },
      { provide: MockDbService, useValue: { ordenesTrabajo: () => [] } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SeguimientoOtPage);
  fixture.detectChanges();
  return { fixture, clientesApi, toast, navigate };
}

describe('SeguimientoOtPage', () => {
  it('carga la OT y calcula distancia/ETA', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(fixture.componentInstance.distanciaKm()).toBe(3.2);
    expect(fixture.componentInstance.etaMin()).toBe(8);
  });

  it('muestra el cargo de visita con técnico asignado', () => {
    expect(setup().fixture.componentInstance.mostrarCargoVisita()).toBe(true);
  });

  it('permite cancelar en estados no finales', () => {
    expect(setup().fixture.componentInstance.puedeCancelar()).toBe(true);
  });

  it('no permite cancelar una OT finalizada', () => {
    const { fixture } = setup({ ...orden, estado: 'FINALIZADA' });
    expect(fixture.componentInstance.puedeCancelar()).toBe(false);
  });

  it('confirma la cancelación y navega al panel', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.motivoControl.setValue('ya no lo necesito');

    fixture.componentInstance.confirmarCancelacion();

    expect(clientesApi.cancelarOt).toHaveBeenCalledWith('ot1', 'ya no lo necesito');
    expect(toast.warning).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/panel']);
  });

  it('no cancela sin motivo válido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.confirmarCancelacion();
    expect(clientesApi.cancelarOt).not.toHaveBeenCalled();
  });

  it('abre una disputa con motivo', () => {
    const { fixture, clientesApi, toast } = setup();
    fixture.componentInstance.motivoDisputaControl.setValue('cobro excesivo');

    fixture.componentInstance.confirmarDisputa();

    expect(clientesApi.abrirDisputa).toHaveBeenCalledWith('ot1', 'cobro excesivo');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.mostrarModalDisputa()).toBe(false);
  });

  it('reporta error al abrir la disputa', () => {
    const { fixture, clientesApi, toast } = setup();
    clientesApi.abrirDisputa.mockReturnValue(throwError(() => new Error('backend')));
    fixture.componentInstance.motivoDisputaControl.setValue('motivo válido');

    fixture.componentInstance.confirmarDisputa();

    expect(toast.error).toHaveBeenCalledWith('No se pudo abrir la disputa', 'backend');
  });

  it('actualiza el radio de búsqueda', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.actualizarRadio(15);
    expect(fixture.componentInstance.ot()?.radioBusquedaKm).toBe(15);
    expect(toast.info).toHaveBeenCalled();
  });
});
