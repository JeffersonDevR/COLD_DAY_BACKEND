import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtResponse } from '@core/models/common.models';
import { OfertaCreada, SseService } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { OtApi } from '@core/service/ot-api';
import { MobileToastService } from '../../core/toast.service';
import { EjecucionOtPage } from './ejecucion-ot.page';

type Stub = ReturnType<typeof vi.fn>;

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0012',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'ASIGNADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function presenciaStub() {
  return {
    sincronizarOt: vi.fn(),
    liberarContexto: vi.fn(),
    modo: signal('ejecutando'),
    compartirUbicacion: signal(true),
    switchBloqueado: signal(true),
    reportando: signal(true),
    motivo: signal<string | null>(null),
    sincronizarOts: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    reintentar: vi.fn(),
  };
}

function setup({
  orden = ot(),
  tecnicos,
  getOtById,
}: {
  orden?: OtResponse;
  tecnicos?: Record<string, Stub>;
  getOtById?: Stub;
} = {}) {
  const api = {
    getOtById: getOtById ?? vi.fn(() => of(orden)),
    getInsumosOt: vi.fn(() => of([])),
    iniciarDesplazamiento: vi.fn(() => of(undefined)),
    llegarADomicilio: vi.fn(() => of(undefined)),
    registrarDiagnostico: vi.fn(() => of(undefined)),
    finalizarServicio: vi.fn(() => of(undefined)),
    ...tecnicos,
  };
  const presencia = presenciaStub();
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const sse = { abrirOtStream: vi.fn(() => new Subject()) };

  TestBed.configureTestingModule({
    imports: [EjecucionOtPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'ot1' })) } },
      { provide: OtApi, useValue: { getOtById: api.getOtById } },
      { provide: TecnicosApi, useValue: api },
      { provide: TecnicoPresenciaService, useValue: presencia },
      { provide: SseService, useValue: sse },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<EjecucionOtPage> = TestBed.createComponent(EjecucionOtPage);
  fixture.detectChanges();

  return { fixture, api, presencia, toast, navigate };
}

function texto(fixture: ComponentFixture<EjecucionOtPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('EjecucionOtPage (B3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra la orden y su estado', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('OT-2026-0012');
    expect(texto(fixture)).toContain('Asignada');
  });

  it('bloquea el desplazamiento si la visita no está paga', () => {
    const { fixture, api, toast } = setup({
      orden: ot({ visitaPagada: false } as Partial<OtResponse>),
    });
    expect(fixture.nativeElement.querySelector('[data-testid="visita-pendiente"]')).toBeTruthy();
    fixture.componentInstance.iniciarDesplazamiento();
    expect(api.iniciarDesplazamiento).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('inicia el desplazamiento cuando la visita está paga', () => {
    const { fixture, api } = setup({
      orden: ot({ visitaPagada: true } as Partial<OtResponse>),
    });
    fixture.componentInstance.iniciarDesplazamiento();
    expect(api.iniciarDesplazamiento).toHaveBeenCalledWith('ot1');
  });

  it('registra la llegada', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_CAMINO' }) });
    fixture.componentInstance.llegarADomicilio();
    expect(api.llegarADomicilio).toHaveBeenCalledWith('ot1');
  });

  it('no envía un diagnóstico inválido', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    fixture.componentInstance.enviarDiagnostico();
    expect(api.registrarDiagnostico).not.toHaveBeenCalled();
  });

  it('envía diagnóstico y presupuesto con los montos', () => {
    const { fixture, api } = setup({ orden: ot({ estado: 'EN_DIAGNOSTICO' }) });
    const page = fixture.componentInstance;
    page.diagnosticoForm.setValue({
      diagnostico: 'Compresor con fuga.',
      manoDeObra: 200000,
      repuestos: 150000,
    });
    page.enviarDiagnostico();
    expect(api.registrarDiagnostico).toHaveBeenCalledWith('ot1', {
      diagnostico: 'Compresor con fuga.',
      manoDeObra: 200000,
      repuestos: 150000,
      insumos: [],
    });
  });

  it('finaliza el servicio con el medio elegido', () => {
    const { fixture, api, presencia } = setup({ orden: ot({ estado: 'EN_REPARACION' }) });
    fixture.componentInstance.finalizarServicio();
    expect(api.finalizarServicio).toHaveBeenCalledWith('ot1', 'EFECTIVO');
    expect(presencia.liberarContexto).toHaveBeenCalled();
  });

  it('muestra el error de carga con reintentar', () => {
    const { fixture } = setup({
      getOtById: vi.fn(() => throwError(() => new ApiHttpError('No existe', 404))),
    });
    expect(fixture.nativeElement.querySelector('[data-testid="ot-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ot-reintentar"]')).toBeTruthy();
  });
});
