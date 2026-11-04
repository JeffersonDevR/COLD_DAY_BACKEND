import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtApi } from '@core/service/ot-api';
import { ClientesApi } from '@core/service/clientes-api';
import { OtResponse } from '@core/models/common.models';
import { MobileToastService } from '../../core/toast.service';
import { CalificarPage } from './calificar.page';

/** A free-form vitest mock: the TestBed useValue does not constrain it. */
type Stub = ReturnType<typeof vi.fn>;

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0009',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría y gotea agua.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'FINALIZADA',
    auxiliaresRequeridos: 0,
    tecnicoId: 'tec-1',
    tecnicoNombre: 'Carlos Pérez',
    ...overrides,
  };
}

function setup({
  otApi,
  clientesApi,
}: {
  otApi?: { getOtById?: Stub };
  clientesApi?: { calificarServicio?: Stub };
} = {}) {
  const getOtById = otApi?.getOtById ?? vi.fn(() => of(ot()));
  const calificarServicio = clientesApi?.calificarServicio ?? vi.fn(() => of(undefined));
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CalificarPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById } },
      { provide: ClientesApi, useValue: { calificarServicio } },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<CalificarPage> = TestBed.createComponent(CalificarPage);
  fixture.detectChanges();

  return { fixture, api: { getOtById }, clientes: { calificarServicio }, toast, navigate };
}

function texto(fixture: ComponentFixture<CalificarPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

function botonEnviar(fixture: ComponentFixture<CalificarPage>): HTMLButtonElement {
  return fixture.nativeElement.querySelector(
    '[data-testid="enviar-calificacion"]',
  ) as HTMLButtonElement;
}

function estrella(fixture: ComponentFixture<CalificarPage>, n: number): HTMLButtonElement {
  return fixture.nativeElement.querySelector(
    `[data-testid="estrella-${n}"]`,
  ) as HTMLButtonElement;
}

function tag(fixture: ComponentFixture<CalificarPage>, index: number): HTMLButtonElement {
  return fixture.nativeElement.querySelector(`[data-testid="tag-${index}"]`) as HTMLButtonElement;
}

describe('CalificarPage (A9)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra el código de la OT y su estado', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('OT-2026-0009');
    expect(fixture.nativeElement.querySelector('[data-testid="ot-estado"]').textContent).toContain(
      'Finalizada',
    );
  });

  it('no permite enviar sin puntaje', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('Sin puntaje');
    expect(botonEnviar(fixture).disabled).toBe(true);

    fixture.componentInstance.enviarCalificacion();
    expect(TestBed.inject(ClientesApi).calificarServicio).not.toHaveBeenCalled();
  });

  it('arma el payload exacto con la sección de aspectos aunque no haya tags', () => {
    const { fixture, clientes, navigate } = setup();

    estrella(fixture, 4).click();
    fixture.detectChanges();
    expect(texto(fixture)).toContain('4 de 5');

    botonEnviar(fixture).click();
    fixture.detectChanges();

    expect(clientes.calificarServicio).toHaveBeenCalledWith('ot1', 4, ' [Aspectos: ]');
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('incluye comentario y tags seleccionados en el payload', () => {
    const { fixture, clientes } = setup();

    estrella(fixture, 5).click();
    tag(fixture, 0).click();
    tag(fixture, 2).click();
    fixture.detectChanges();

    const comentario = fixture.nativeElement.querySelector(
      '[data-testid="comentario"]',
    ) as HTMLElement | null;
    expect(comentario).toBeTruthy();
    fixture.componentInstance.comentarioCtrl.setValue('Muy buen trabajo');
    fixture.detectChanges();

    botonEnviar(fixture).click();
    fixture.detectChanges();

    expect(clientes.calificarServicio).toHaveBeenCalledWith(
      'ot1',
      5,
      'Muy buen trabajo [Aspectos: Puntualidad en llegada, Calidad técnica impecable]',
    );
  });

  it('el destino muestra la reseña registrada y navega al seguimiento', () => {
    const { fixture, toast, navigate } = setup();

    estrella(fixture, 3).click();
    fixture.detectChanges();
    botonEnviar(fixture).click();
    fixture.detectChanges();

    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'ot1']);
  });

  it('un 409 explica por qué no se puede calificar y conserva el comentario', () => {
    const { fixture, toast, navigate } = setup({
      clientesApi: {
        calificarServicio: vi.fn(() =>
          throwError(() => new ApiHttpError('Orden no calificable', 409, [])),
        ),
      },
    });

    estrella(fixture, 2).click();
    fixture.detectChanges();

    const comentario = fixture.nativeElement.querySelector(
      '[data-testid="comentario"]',
    ) as HTMLElement | null;
    expect(comentario).toBeTruthy();
    fixture.componentInstance.comentarioCtrl.setValue('Texto que no se debe perder');
    fixture.detectChanges();

    botonEnviar(fixture).click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    const mensaje = toast.error.mock.calls[0]?.[1] as string;
    expect(mensaje).toContain('todavía no se puede calificar');
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.comentarioCtrl.value).toBe('Texto que no se debe perder');
  });

  it('bloquea la calificación cuando la OT no está finalizada', () => {
    const { fixture } = setup({ otApi: { getOtById: vi.fn(() => of(ot({ estado: 'EN_REPARACION' }))) } });

    expect(fixture.nativeElement.querySelector('[data-testid="calificar-no-finalizada"]')).toBeTruthy();
    estrella(fixture, 5).click();
    fixture.detectChanges();
    expect(botonEnviar(fixture).disabled).toBe(true);
  });

  it('avisa cuando la OT ya tiene una reseña registrada', () => {
    const { fixture } = setup({
      otApi: {
        getOtById: vi.fn(() =>
          of(ot({ calificacion: { estrellas: 5, comentario: 'Excelente' } as never })),
        ),
      },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="calificar-ya-hecha"]')).toBeTruthy();
  });

  it('muestra el error de carga con reintentar y no una pantalla vacía', () => {
    const { fixture } = setup({
      otApi: { getOtById: vi.fn(() => throwError(() => new ApiHttpError('No existe', 404, []))) },
    });

    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ot-reintentar"]')).toBeTruthy();
  });
});
