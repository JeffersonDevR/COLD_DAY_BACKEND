import { TestBed } from '@angular/core/testing';
import { EstadoBadge } from './estado-badge';

describe('EstadoBadge', () => {
  async function create(estado: string, showIcon = true) {
    await TestBed.configureTestingModule({ imports: [EstadoBadge] }).compileComponents();
    const fixture = TestBed.createComponent(EstadoBadge);
    fixture.componentRef.setInput('estado', estado);
    fixture.componentRef.setInput('showIcon', showIcon);
    fixture.detectChanges();
    return fixture;
  }

  const casos: { estado: string; label: string; severity: string }[] = [
    { estado: 'FINALIZADA', label: 'Finalizada', severity: 'success' },
    { estado: 'APROBADO', label: 'Aprobado', severity: 'success' },
    { estado: 'BUSCANDO_TECNICO', label: 'Buscando Técnico', severity: 'info' },
    { estado: 'EN_CAMINO', label: 'En Camino', severity: 'info' },
    { estado: 'SOLICITADA', label: 'Solicitada', severity: 'warn' },
    { estado: 'PENDIENTE_CONSIGNACION', label: 'Pendiente', severity: 'warn' },
    { estado: 'DISPUTADA', label: 'En Disputa', severity: 'danger' },
    { estado: 'BLOQUEADO_POR_LIQUIDACION', label: 'Bloqueado por Liquidación', severity: 'danger' },
    { estado: 'ABIERTA', label: 'Abierta', severity: 'danger' },
  ];

  casos.forEach(({ estado, label, severity }) => {
    it(`mapea ${estado}`, async () => {
      const fixture = await create(estado);
      expect(fixture.componentInstance.label()).toBe(label);
      expect(fixture.componentInstance.severity()).toBe(severity);
      expect(fixture.nativeElement.textContent).toContain(label);
    });
  });

  it('usa valores por defecto para estados desconocidos', async () => {
    const fixture = await create('DESCONOCIDO');
    expect(fixture.componentInstance.label()).toBe('DESCONOCIDO');
    expect(fixture.componentInstance.severity()).toBe('secondary');
    expect(fixture.componentInstance.iconClass()).toBe('pi pi-info-circle');
  });

  it('oculta el icono cuando showIcon es false', async () => {
    const fixture = await create('FINALIZADA', false);
    expect(fixture.componentInstance.showIcon()).toBe(false);
  });
});
