import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { LiquidacionResponse, TecnicoResponse } from '@core/models/common.models';
import { LiquidacionApi } from '@core/service/liquidacion-api';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { LiquidacionesTecnicoPage } from './liquidaciones-tecnico.page';

function liquidacion(overrides: Partial<LiquidacionResponse> = {}): LiquidacionResponse {
  return {
    id: 'L-1',
    otId: 'OT-UUID',
    otCodigo: 'OT-2026-0001',
    tecnicoId: 'T-1',
    montoServicio: 100_000,
    comision: 15_000,
    estado: 'PENDIENTE_CONSIGNACION',
    medioPago: 'EFECTIVO',
    fechaRegistro: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

function setup({
  lista = [] as LiquidacionResponse[],
  falla = false,
  sinPerfil = false,
} = {}) {
  const tecnicosApi = {
    getMiPerfil: vi.fn(() =>
      sinPerfil ? of(undefined) : of({ id: 'T-1' } as TecnicoResponse),
    ),
  };
  const liquidacionApi = {
    getLiquidacionesPorTecnico: vi.fn(() =>
      falla ? throwError(() => new Error('sin red')) : of(lista),
    ),
  };

  TestBed.configureTestingModule({
    imports: [LiquidacionesTecnicoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: LiquidacionApi, useValue: liquidacionApi },
    ],
  });

  const fixture: ComponentFixture<LiquidacionesTecnicoPage> =
    TestBed.createComponent(LiquidacionesTecnicoPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, liquidacionApi };
}

function texto(fixture: ComponentFixture<LiquidacionesTecnicoPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('LiquidacionesTecnicoPage (B5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pide las liquidaciones del técnico autenticado, sin enviar un id', () => {
    const { liquidacionApi } = setup({ lista: [liquidacion()] });

    expect(liquidacionApi.getLiquidacionesPorTecnico).toHaveBeenCalledWith('T-1');
  });

  it('suma solo la comisión pendiente de consignar', () => {
    const { fixture } = setup({
      lista: [
        liquidacion({ id: 'L-1', comision: 15_000 }),
        liquidacion({ id: 'L-2', comision: 9_000 }),
        liquidacion({ id: 'L-3', estado: 'EN_VERIFICACION', comision: 30_000 }),
        liquidacion({ id: 'L-4', estado: 'APROBADA', comision: 12_000 }),
      ],
    });

    expect(fixture.componentInstance.porConsignar()).toBe(24_000);
    expect(texto(fixture)).toContain('24.000');
  });

  it('muestra el estado vacío cuando no hay liquidaciones', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('[data-testid="liquidaciones-vacio"]')).toBeTruthy();
  });

  it('lista cada liquidación con su código de OT y su comisión', () => {
    const { fixture } = setup({ lista: [liquidacion()] });

    const textoPantalla = texto(fixture);
    expect(textoPantalla).toContain('OT-2026-0001');
    expect(textoPantalla).toContain('15.000');
    expect(textoPantalla).toContain('Pendiente de consignación');
  });

  it('muestra el motivo cuando la liquidación fue rechazada', () => {
    const { fixture } = setup({
      lista: [
        liquidacion({
          id: 'L-9',
          estado: 'RECHAZADA',
          motivoRechazo: 'El comprobante no coincide con el monto.',
        }),
      ],
    });

    expect(texto(fixture)).toContain('El comprobante no coincide con el monto.');
  });

  it('ofrece reintentar cuando la carga falla', () => {
    const { fixture } = setup({ falla: true });

    expect(fixture.nativeElement.querySelector('[data-testid="liquidaciones-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="reintentar-liquidaciones"]')).toBeTruthy();
  });

  it('sin perfil de técnico el resultado es el estado de error, no una lista vacía silenciosa', () => {
    const { fixture } = setup({ sinPerfil: true });

    expect(fixture.componentInstance.fallo()).toBe(true);
  });
});
