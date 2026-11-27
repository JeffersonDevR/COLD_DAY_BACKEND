import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
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

describe('Historial del cliente', () => {
  afterEach(() => TestBed.resetTestingModule());

  const tarjetas = (fixture: ComponentFixture<MobileEquiposPage>) =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="historial-ot"]'),
    ) as HTMLElement[];

  it('una tarjeta por orden, de la más reciente a la más antigua y sin fecha al final', () => {
    const { fixture } = setup({
      ots: [
        ot({ id: 'sin', codigo: 'OT-SIN', fechaCreacion: undefined }),
        ot({ id: 'vieja', codigo: 'OT-VIEJA', fechaCreacion: '2026-10-01T10:00:00Z' }),
        ot({ id: 'nueva', codigo: 'OT-NUEVA', fechaCreacion: '2026-11-20T10:00:00Z' }),
      ],
    });

    expect(tarjetas(fixture).map((t) => t.querySelector('.cd-ot__codigo')?.textContent?.trim()))
      .toEqual(['OT-NUEVA', 'OT-VIEJA', 'OT-SIN']);
    expect(texto(fixture)).toContain('Aire acondicionado');
  });

  it('la prioridad solo sale en las activas y dicha completa', () => {
    const { fixture } = setup({
      ots: [
        ot({ id: 'activa', estado: 'EN_CAMINO', prioridad: 'ALTA' }),
        ot({ id: 'cerrada', estado: 'FINALIZADA', fechaCreacion: '2026-10-01T10:00:00Z' }),
      ],
    });

    const [activa, cerrada] = tarjetas(fixture);
    expect(activa.querySelector('[data-testid="prioridad-chip"]')?.textContent?.trim()).toBe(
      'Prioridad alta',
    );
    expect(cerrada.querySelector('[data-testid="prioridad-chip"]')).toBeNull();
  });

  it('«Revisar» abre esa orden y no hay conteos ni «última OT»', () => {
    const { fixture } = setup({ ots: [ot({ id: 'abc' })] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const boton = fixture.nativeElement.querySelector(
      '[data-testid="historial-revisar"]',
    ) as HTMLElement & { fill?: string };

    expect(boton.textContent?.trim()).toBe('Revisar');
    expect(boton.fill).toBe('outline');
    boton.click();
    expect(navigate).toHaveBeenCalledWith(['/cliente/ot', 'abc']);
    expect(texto(fixture)).not.toContain('servicios ·');
    expect(texto(fixture)).not.toContain('última OT');
    expect(texto(fixture)).not.toContain('equipos');
  });

  it('omite lo que el backend no entrega', () => {
    const { fixture } = setup({
      ots: [ot({ codigo: undefined, fechaCreacion: undefined, direccion: undefined })],
    });

    expect(texto(fixture)).not.toContain('undefined');
    expect(tarjetas(fixture)[0].querySelector('.cd-ot__codigo')).toBeNull();
    expect(tarjetas(fixture)[0].querySelector('.cd-ot__pie')).toBeNull();
  });

  it('la tarjeta lleva el icono decorativo de su categoría', () => {
    const { fixture } = setup();

    const icono = fixture.nativeElement.querySelector('[data-testid="historial-ot"] .cd-equipo__icono');
    expect(icono?.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.componentInstance.iconoCategoria('LAVADORAS')).toBe('water-outline');
    expect(fixture.componentInstance.iconoCategoria('REFRIGERACION')).toBe('snow-outline');
  });

  it('sin órdenes invita a pedir', () => {
    const { fixture } = setup({ ots: [] });

    expect(fixture.nativeElement.querySelector('[data-testid="equipos-vacio"]')?.textContent).toContain(
      'Aún no tienes servicios',
    );
    expect(texto(fixture)).toContain('Pedir un técnico');
  });

  it('muestra error con reintentar ante una falla de carga', () => {
    const { fixture } = setup({ error: new ApiHttpError('boom', 500) });

    expect(fixture.nativeElement.querySelector('[data-testid="equipos-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="equipos-reintentar"]')).toBeTruthy();
  });
});

describe('Historial: deslizar para recargar', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('tiene el indicador en la pantalla', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('ion-refresher[slot="fixed"]')).not.toBeNull();
  });

  it('trae los datos nuevos', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.getOtsPorCliente.mockReturnValue(of([ot({ codigo: 'OT-NUEVA' })]));
    fixture.componentInstance.recargar().subscribe();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('OT-NUEVA');
  });

  it('si falla, entrega el error y conserva lo que se ve', () => {
    const contexto = setup();
    const { fixture } = contexto;
    contexto.getOtsPorCliente.mockReturnValue(throwError(() => new ApiHttpError('boom', 500)));
    const error = vi.fn();
    fixture.componentInstance.recargar().subscribe({ error });
    fixture.detectChanges();
    expect(error).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('OT-2026-0004');
  });
});

describe('Historial: detalles', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sin falla no deja un párrafo vacío', () => {
    const { fixture } = setup({ ots: [ot({ descripcionFalla: '' })] });

    expect(fixture.nativeElement.querySelector('.cd-historial__falla')).toBeNull();
  });

  it('prefiere la dirección, como el resto de listas', () => {
    const { fixture } = setup({ ots: [ot({ direccion: 'Calle 15', barrio: 'Caobos' })] });

    expect(texto(fixture)).toContain('Calle 15');
    expect(texto(fixture)).not.toContain('Caobos');
  });

  it('deslizar sin perfil de cliente muestra su aviso y no un error', () => {
    const { fixture, getOtsPorCliente } = setup();
    getOtsPorCliente.mockReturnValue(
      throwError(() => new ApiHttpError('No existe un perfil de cliente para el usuario: 7', 404)),
    );
    const error = vi.fn();

    fixture.componentInstance.recargar().subscribe({ error });
    fixture.detectChanges();

    expect(error).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="equipos-sin-perfil"]')).not.toBeNull();
  });
});
