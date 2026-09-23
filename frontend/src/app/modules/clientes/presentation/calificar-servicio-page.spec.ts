import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CalificarServicioPage } from './calificar-servicio-page';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

const orden: OtResponse = {
  id: 'ot1',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  estado: 'FINALIZADA',
  auxiliaresRequeridos: 0,
  tecnicoNombre: 'Juan Pérez',
};

function setup(calificar: ReturnType<typeof vi.fn>) {
  const toast = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [CalificarServicioPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById: () => of(orden) } },
      { provide: ClientesApi, useValue: { calificarServicio: calificar } },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CalificarServicioPage);
  fixture.detectChanges();
  return { fixture, toast, navigate };
}

describe('CalificarServicioPage', () => {
  it('carga la OT desde el parámetro de ruta', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)));
    expect(fixture.componentInstance.otId()).toBe('ot1');
    expect(fixture.componentInstance.ot()?.id).toBe('ot1');
  });

  it('alterna los tags destacados', () => {
    const { fixture } = setup(vi.fn(() => of(undefined)));
    const page = fixture.componentInstance;
    expect(page.hasTag('Puntualidad en llegada')).toBe(true);
    page.toggleTag('Puntualidad en llegada');
    expect(page.hasTag('Puntualidad en llegada')).toBe(false);
    page.toggleTag('Calidad técnica impecable');
    expect(page.hasTag('Calidad técnica impecable')).toBe(true);
  });

  it('envía la calificación con estrellas, comentario y tags', () => {
    const calificar = vi.fn(() => of(undefined));
    const { fixture, toast, navigate } = setup(calificar);
    fixture.componentInstance.estrellas.set(4);

    fixture.componentInstance.enviarCalificacion();

    expect(calificar).toHaveBeenCalledWith(
      'ot1',
      4,
      expect.stringContaining('[Aspectos: Puntualidad en llegada, Limpieza del área]'),
    );
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('muestra error si la calificación no está disponible', () => {
    const calificar = vi.fn(() => throwError(() => new Error('pendiente backend')));
    const { fixture, toast } = setup(calificar);

    fixture.componentInstance.enviarCalificacion();

    expect(toast.error).toHaveBeenCalledWith('Calificación no disponible', 'pendiente backend');
  });
});
