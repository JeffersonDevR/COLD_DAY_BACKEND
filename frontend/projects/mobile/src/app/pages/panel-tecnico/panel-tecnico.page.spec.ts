import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtResponse, TecnicoResponse } from '@core/models/common.models';
import { SseService, OfertaCreada } from '@core/service/sse.service';
import { TecnicoPresenciaService } from '@core/service/tecnico-presencia.service';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { MobileToastService } from '../../core/toast.service';
import { PanelTecnicoPageMobile } from './panel-tecnico.page';

type Stub = ReturnType<typeof vi.fn>;

function tecnico(overrides: Partial<TecnicoResponse> = {}): TecnicoResponse {
  return {
    id: 'tec-1',
    nombre: 'Lucas Vega',
    correo: 'lucas@coldday.com',
    estadoValidacion: 'APROBADO',
    estadoOperativo: 'DISPONIBLE',
    ...overrides,
  };
}

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0011',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'No enfría.',
    direccion: 'Calle 15 # 3E-28',
    estado: 'ASIGNADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

function presenciaStub(overrides: Record<string, unknown> = {}) {
  return {
    modo: signal<'apagada' | 'compartiendo' | 'ejecutando'>('apagada'),
    compartirUbicacion: signal(false),
    switchBloqueado: signal(false),
    reportando: signal(false),
    motivo: signal<string | null>(null),
    sincronizarOts: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    reintentar: vi.fn(),
    ...overrides,
  };
}

function setup({
  tecnicoApi,
  otsApi,
  presencia = presenciaStub(),
}: {
  tecnicoApi?: { getMiPerfil?: Stub };
  otsApi?: { getMisOts?: Stub };
  presencia?: ReturnType<typeof presenciaStub>;
} = {}) {
  const api = {
    getMiPerfil: tecnicoApi?.getMiPerfil ?? vi.fn(() => of(tecnico())),
    getMisOts: otsApi?.getMisOts ?? vi.fn(() => of([ot()])),
    actualizarEstadoOperativo: vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const sse = { abrirOfertasTecnico: vi.fn(() => new Subject<OfertaCreada>()) };

  TestBed.configureTestingModule({
    imports: [PanelTecnicoPageMobile],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: api },
      { provide: SseService, useValue: sse },
      { provide: TecnicoPresenciaService, useValue: presencia },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture: ComponentFixture<PanelTecnicoPageMobile> =
    TestBed.createComponent(PanelTecnicoPageMobile);
  fixture.detectChanges();

  return { fixture, api, toast, navigate, presencia };
}

function texto(fixture: ComponentFixture<PanelTecnicoPageMobile>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('PanelTecnicoPageMobile (B2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra el técnico y sus órdenes activas', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('Lucas Vega');
    expect(texto(fixture)).toContain('OT-2026-0011');
    expect(texto(fixture)).toContain('Asignada');
  });

  it('sincroniza la política de presencia con las OTs cargadas', () => {
    const { presencia } = setup();
    expect(presencia.sincronizarOts).toHaveBeenCalled();
  });

  it('muestra error con reintentar y no una lista vacía silenciosa', () => {
    const { fixture } = setup({
      otsApi: { getMisOts: vi.fn(() => throwError(() => new ApiHttpError('boom', 500))) },
    });
    expect(fixture.nativeElement.querySelector('[data-testid="ots-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="ots-reintentar"]')).toBeTruthy();
  });

  it('muestra el estado vacío con CTA al radar', () => {
    const { fixture, navigate } = setup({ otsApi: { getMisOts: vi.fn(() => of([])) } });
    const cta = fixture.nativeElement.querySelector('[data-testid="ir-radar"]') as HTMLButtonElement;
    expect(cta).toBeTruthy();
    cta.click();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/radar']);
  });

  it('cambia la disponibilidad contra el API', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.cambiarDisponibilidad('OCUPADO');
    expect(api.actualizarEstadoOperativo).toHaveBeenCalledWith('OCUPADO');
  });

  it('explica el 409 de disponibilidad (OT en curso)', () => {
    const { fixture, api, toast } = setup();
    api.actualizarEstadoOperativo.mockReturnValue(
      throwError(() => new ApiHttpError('activa', 409)),
    );
    fixture.componentInstance.cambiarDisponibilidad('OCUPADO');
    expect(toast.error).toHaveBeenCalled();
    expect(toast.error.mock.calls[0]?.[1]).toContain('orden en curso');
  });

  it('el switch de ubicación llama a la política, no al GPS', () => {
    const { fixture, presencia } = setup();
    fixture.componentInstance.alternarCompartirUbicacion(
      new CustomEvent('ionChange', { detail: { checked: true } }),
    );
    expect(presencia.activar).toHaveBeenCalled();
  });
});
