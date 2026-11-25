import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  constructOutline,
  snowOutline,
  thermometerOutline,
} from 'ionicons/icons';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { OtResponse, UsuarioResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ClientesApi } from '@core/service/clientes-api';
import { MobileEquiposPage } from './equipos.page';

// Sin registro, ion-icon intenta bajar el SVG y ensucia la salida del runner.
addIcons({
  addCircleOutline,
  constructOutline,
  snowOutline,
  thermometerOutline,
});

const usuario: UsuarioResponse = {
  id: 7,
  nombre: 'María Gómez',
  correo: 'maria@coldday.co',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function ot(overrides: Partial<OtResponse> = {}): OtResponse {
  return {
    id: 'ot1',
    codigo: 'OT-2026-0004',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'Split 3000F gotea agua en el living',
    estado: 'EN_CAMINO',
    auxiliaresRequeridos: 0,
    fechaCreacion: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

function setup({ ots, error }: { ots?: OtResponse[]; error?: ApiHttpError } = {}) {
  const auth = { currentUser: signal(usuario) };
  const getOtsPorCliente = vi.fn(() => (error ? throwError(() => error) : of(ots ?? [ot()])));

  TestBed.configureTestingModule({
    imports: [MobileEquiposPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ClientesApi, useValue: { getOtsPorCliente } },
    ],
  });

  const fixture: ComponentFixture<MobileEquiposPage> = TestBed.createComponent(MobileEquiposPage);
  fixture.detectChanges();
  return { fixture, getOtsPorCliente };
}

function texto(fixture: ComponentFixture<MobileEquiposPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('MobileEquiposPage (A10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('marca En curso el equipo que tiene órdenes activas y no el que ya cerró todo', () => {
    const { fixture } = setup({
      ots: [
        ot({ id: 'a', categoriaServicio: 'AIRE_ACONDICIONADO', estado: 'EN_CAMINO' }),
        ot({ id: 'b', categoriaServicio: 'AIRE_ACONDICIONADO', estado: 'FINALIZADA' }),
        ot({ id: 'c', categoriaServicio: 'ELECTRICIDAD', estado: 'FINALIZADA' }),
        ot({ id: 'd', categoriaServicio: 'LAVADORAS', estado: 'SIN_TECNICOS_DISPONIBLES' }),
      ],
    });

    const tarjetas = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="equipo"]') as NodeListOf<HTMLElement>,
    );
    const conCurso = tarjetas.filter((t) => t.querySelector('[data-testid="equipo-en-curso"]'));

    expect(tarjetas).toHaveLength(3);
    expect(conCurso).toHaveLength(1);
    expect(conCurso[0].textContent).toContain('1 en curso');
  });

  it('agrupa por categoría y muestra la falla de la última OT', () => {
    const { fixture } = setup({
      ots: [
        ot({
          id: 'ot2',
          categoriaServicio: 'REFRIGERACION',
          descripcionFalla: 'Nevera no enfría',
          fechaCreacion: '2026-11-10T10:00:00Z',
        }),
        ot(),
      ],
    });

    const tarjetas = fixture.nativeElement.querySelectorAll('[data-testid="equipo"]');
    expect(tarjetas.length).toBe(2);
    expect(texto(fixture)).toContain('Aire acondicionado');
    expect(texto(fixture)).toContain('Refrigeración');
    expect(texto(fixture)).toContain('Split 3000F gotea agua en el living');
    expect(texto(fixture)).toContain('Nevera no enfría');
  });

  it('la tarjeta lleva el icono decorativo de su categoría', () => {
    const { fixture } = setup();

    const icono = fixture.nativeElement.querySelector('[data-testid="equipo"] .cd-equipo__icono');
    expect(icono?.getAttribute('aria-hidden')).toBe('true');
  });

  it('cada categoría mapea a su icono registrado', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance;

    expect(page.iconoCategoria('AIRE_ACONDICIONADO')).toBe('thermometer-outline');
    expect(page.iconoCategoria('REFRIGERACION')).toBe('snow-outline');
    expect(page.iconoCategoria('LAVADORAS')).toBe('water-outline');
    expect(page.iconoCategoria('ELECTRICIDAD')).toBe('flash-outline');
    expect(page.iconoCategoria('CAMARAS_VIGILANCIA')).toBe('videocam-outline');
  });

  it('muestra el estado vacío cuando no hay órdenes', () => {
    const { fixture } = setup({ ots: [] });

    expect(fixture.nativeElement.querySelector('[data-testid="equipos-vacio"]')).toBeTruthy();
  });

  it('muestra error con reintentar ante una falla de carga', () => {
    const { fixture } = setup({ error: new ApiHttpError('boom', 500) });

    expect(fixture.nativeElement.querySelector('[data-testid="equipos-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="equipos-reintentar"]')).toBeTruthy();
  });
});
