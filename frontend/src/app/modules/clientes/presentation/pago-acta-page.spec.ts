import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PagoActaPage } from './pago-acta-page';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'x',
  estado: 'FINALIZADA',
  auxiliaresRequeridos: 0,
  tecnicoNombre: 'Juan',
  punto: { latitud: 7.89, longitud: -72.5 },
  presupuesto: { aprobado: true, total: 150000, manoObra: 90000, repuestos: 60000 },
};

function setup() {
  const ctxStub = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxStub as unknown as CanvasRenderingContext2D,
  );
  const toast = { success: vi.fn() };
  const estimacion = {
    distanciaKm: 9.5,
    tarifaFuente: 'LINEAL' as const,
    banda: 1,
    tarifa: 35000,
    fueraDeRango: false,
  };
  TestBed.configureTestingModule({
    imports: [PagoActaPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById: () => of(orden), estimarTarifa: () => of(estimacion) } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(PagoActaPage);
  fixture.detectChanges();
  return { fixture, toast, ctxStub };
}

describe('PagoActaPage', () => {
  it('carga la OT y calcula el total a pagar', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
    expect(fixture.componentInstance.totalMonto()).toBe(185000);
  });

  it('registra la firma al dibujar y la limpia', () => {
    const { fixture, ctxStub } = setup();
    const page = fixture.componentInstance;

    page.startDrawing({ clientX: 10, clientY: 10 } as MouseEvent);
    page.draw({ clientX: 20, clientY: 20 } as MouseEvent);
    expect(page.hasFirma()).toBe(true);

    page.limpiarFirma();
    expect(page.hasFirma()).toBe(false);
    expect(ctxStub.clearRect).toHaveBeenCalled();
  });

  it('genera el acta firmada', () => {
    const { fixture, toast } = setup();
    fixture.componentInstance.guardarYDescargarActa();
    expect(toast.success).toHaveBeenCalledWith('Acta Generada', expect.any(String));
  });

  it('permite elegir el medio de pago', () => {
    const { fixture } = setup();
    fixture.componentInstance.medioPago.set('TRANSFERENCIA');
    expect(fixture.componentInstance.medioPago()).toBe('TRANSFERENCIA');
  });
});
