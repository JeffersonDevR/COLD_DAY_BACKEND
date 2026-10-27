import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HistorialEquiposPage } from './historial-equipos-page';
import { AuthService } from '../../core/service/auth.service';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtResponse } from '../../core/models/common.models';

function ot(overrides: Partial<OtResponse>): OtResponse {
  return {
    id: 'ot-1',
    codigo: 'OT-2026-0001',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'FINALIZADA',
    auxiliaresRequeridos: 0,
    ...overrides,
  };
}

const ordenes: OtResponse[] = [
  ot({
    id: 'ot-vieja',
    codigo: 'OT-2026-0001',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'no enfría',
    estado: 'FINALIZADA',
    fechaCreacion: '2026-02-10T10:00:00Z',
  }),
  ot({
    id: 'ot-ac',
    codigo: 'OT-2026-0005',
    categoriaServicio: 'AIRE_ACONDICIONADO',
    descripcionFalla: 'gotea agua',
    estado: 'EN_REPARACION',
    fechaCreacion: '2026-05-15T10:00:00Z',
  }),
  ot({
    id: 'ot-nueva',
    codigo: 'OT-2026-0007',
    categoriaServicio: 'REFRIGERACION',
    descripcionFalla: 'hace ruido el compresor',
    estado: 'EN_DIAGNOSTICO',
    fechaCreacion: '2026-06-02T10:00:00Z',
  }),
];

function setup(getOtsPorCliente: ReturnType<typeof vi.fn>, usuarioId: string | null = 'CLI-1') {
  TestBed.configureTestingModule({
    imports: [HistorialEquiposPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => (usuarioId ? { id: usuarioId } : null) } },
      { provide: ClientesApi, useValue: { getOtsPorCliente } },
    ],
  });
  const fixture = TestBed.createComponent(HistorialEquiposPage);
  fixture.detectChanges();
  return fixture;
}

describe('HistorialEquiposPage', () => {
  it('pide las órdenes del cliente autenticado', () => {
    const getOtsPorCliente = vi.fn(() => of(ordenes));
    setup(getOtsPorCliente);
    expect(getOtsPorCliente).toHaveBeenCalledWith('CLI-1');
  });

  it('arma una tarjeta por categoría con la última OT', () => {
    const fixture = setup(vi.fn(() => of(ordenes)));
    const equipos = fixture.componentInstance.equipos();

    expect(equipos.length).toBe(2);
    // Refrigeración tiene dos OT: manda la más reciente.
    const refrigeracion = equipos.find((e) => e.categoria === 'REFRIGERACION');
    expect(refrigeracion).toMatchObject({
      etiqueta: 'Refrigeración',
      intervenciones: 2,
      ultimaOtId: 'ot-nueva',
      codigoOt: 'OT-2026-0007',
      descripcionFalla: 'hace ruido el compresor',
      estado: 'EN_DIAGNOSTICO',
    });
    expect(refrigeracion?.fecha).toContain('2026');
    // La categoría con la intervención más reciente va primero.
    expect(equipos[0].categoria).toBe('REFRIGERACION');
  });

  it('muestra el equipo, la falla, el estado y el link al seguimiento', () => {
    const fixture = setup(vi.fn(() => of(ordenes)));
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('Refrigeración');
    expect(texto).toContain('hace ruido el compresor');
    expect(texto).toContain('OT-2026-0007');
    expect(texto).toContain('2 servicios registrados');
    expect(texto).toContain('En Diagnóstico');

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some((a) => a.getAttribute('href') === '/cliente/ot/ot-nueva')).toBe(true);
  });

  it('sin órdenes muestra el estado vacío honesto, no tarjetas inventadas', () => {
    const fixture = setup(vi.fn(() => of([])));
    const texto = fixture.nativeElement.textContent as string;

    expect(fixture.componentInstance.equipos()).toEqual([]);
    expect(texto).toContain('Todavía no tenés equipos registrados');
    expect(texto).toContain('Solicitar un servicio');
    expect(texto).not.toContain('LG Dual Inverter');
  });

  it('avisa si la carga falla y reintenta', () => {
    const getOtsPorCliente = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of(ordenes));
    const fixture = setup(getOtsPorCliente);

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar tus equipos.');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getOtsPorCliente).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.equipos().length).toBe(2);
  });

  it('mapea cada categoría a una etiqueta e ícono propios', () => {
    const fixture = setup(
      vi.fn(() =>
        of([
          ot({ id: 'a', categoriaServicio: 'AIRE_ACONDICIONADO', fechaCreacion: '2026-03-01T00:00:00Z' }),
          ot({ id: 'b', categoriaServicio: 'LAVADORAS', fechaCreacion: '2026-03-02T00:00:00Z' }),
          ot({ id: 'c', categoriaServicio: 'ELECTRICIDAD', fechaCreacion: '2026-03-03T00:00:00Z' }),
          ot({ id: 'd', categoriaServicio: 'CAMARAS_VIGILANCIA', fechaCreacion: '2026-03-04T00:00:00Z' }),
        ]),
      ),
    );
    const etiquetas = fixture.componentInstance.equipos().map((e) => e.etiqueta);

    expect(etiquetas).toEqual([
      'Cámaras de vigilancia',
      'Instalaciones eléctricas',
      'Lavadoras',
      'Aires acondicionados',
    ]);
    expect(fixture.componentInstance.equipos().every((e) => e.icono.startsWith('pi pi-'))).toBe(true);
  });
});
