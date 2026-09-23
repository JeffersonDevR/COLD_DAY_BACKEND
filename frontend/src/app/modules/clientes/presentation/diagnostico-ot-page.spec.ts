import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DiagnosticoOtPage } from './diagnostico-ot-page';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'x',
  estado: 'EN_DIAGNOSTICO',
  auxiliaresRequeridos: 0,
  tecnicoNombre: 'Juan',
  punto: { latitud: 7.89, longitud: -72.5 },
  presupuesto: { aprobado: false, total: 150000, manoObra: 90000, repuestos: 60000 },
};

function setup() {
  const clientesApi = {
    aprobarDiagnostico: vi.fn(() => of(undefined)),
    rechazarDiagnostico: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), warning: vi.fn() };
  const estimacion = {
    distanciaKm: 9.5,
    tarifaFuente: 'LINEAL' as const,
    banda: 1,
    tarifa: 35000,
    fueraDeRango: false,
  };
  TestBed.configureTestingModule({
    imports: [DiagnosticoOtPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById: () => of(orden), estimarTarifa: () => of(estimacion) } },
      { provide: ClientesApi, useValue: clientesApi },
      { provide: AuthService, useValue: { currentUser: () => ({ id: 3 }) } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DiagnosticoOtPage);
  fixture.detectChanges();
  return { fixture, clientesApi, toast, navigate };
}

describe('DiagnosticoOtPage', () => {
  it('carga la OT y calcula el total del servicio', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(fixture.componentInstance.totalServicio()).toBe(185000);
  });

  it('aprueba el presupuesto y navega', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.aprobarPresupuesto();
    expect(clientesApi.aprobarDiagnostico).toHaveBeenCalledWith('ot1');
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('rechaza el presupuesto con motivo y navega', () => {
    const { fixture, clientesApi, toast, navigate } = setup();
    fixture.componentInstance.mostrarRechazo.set(true);
    fixture.componentInstance.motivoRechazoCtrl.setValue('costo elevado');

    fixture.componentInstance.rechazarPresupuesto();

    expect(clientesApi.rechazarDiagnostico).toHaveBeenCalledWith('ot1', 'costo elevado');
    expect(toast.warning).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('no rechaza sin motivo válido', () => {
    const { fixture, clientesApi } = setup();
    fixture.componentInstance.motivoRechazoCtrl.setValue('x');
    fixture.componentInstance.rechazarPresupuesto();
    expect(clientesApi.rechazarDiagnostico).not.toHaveBeenCalled();
  });

  it('envía un mensaje al chat', () => {
    const { fixture } = setup();
    const antes = fixture.componentInstance.chatMensajes().length;
    fixture.componentInstance.nuevoMensajeCtrl.setValue('¿Cuánto tarda?');

    fixture.componentInstance.enviarMensaje();

    const mensajes = fixture.componentInstance.chatMensajes();
    expect(mensajes.length).toBe(antes + 1);
    expect(mensajes.at(-1)).toMatchObject({ emisor: 'CLIENTE', texto: '¿Cuánto tarda?' });
  });

  it('no envía mensajes vacíos', () => {
    const { fixture } = setup();
    const antes = fixture.componentInstance.chatMensajes().length;
    fixture.componentInstance.enviarMensaje();
    expect(fixture.componentInstance.chatMensajes().length).toBe(antes);
  });
});
