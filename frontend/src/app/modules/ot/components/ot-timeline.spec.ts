import { TestBed } from '@angular/core/testing';
import { OtTimeline } from './ot-timeline';
import { EstadoOt, HistorialOtItem } from '../../../core/shared/domain/models/common.models';

describe('OtTimeline', () => {
  async function create(estado: EstadoOt, historial: HistorialOtItem[] = []) {
    await TestBed.configureTestingModule({ imports: [OtTimeline] }).compileComponents();
    const fixture = TestBed.createComponent(OtTimeline);
    fixture.componentRef.setInput('estadoActual', estado);
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();
    return fixture;
  }

  it('genera siete pasos del ciclo operativo', async () => {
    const steps = (await create('SOLICITADA')).componentInstance.steps();
    expect(steps.length).toBe(7);
    expect(steps.map((s) => s.estado)).toEqual([
      'SOLICITADA',
      'BUSCANDO_TECNICO',
      'ASIGNADA',
      'EN_CAMINO',
      'EN_DIAGNOSTICO',
      'EN_REPARACION',
      'FINALIZADA',
    ]);
  });

  it('marca el paso actual y los completados', async () => {
    const steps = (await create('EN_CAMINO')).componentInstance.steps();
    expect(steps.find((s) => s.estado === 'EN_CAMINO')?.isCurrent).toBe(true);
    expect(steps.find((s) => s.estado === 'ASIGNADA')?.isCompleted).toBe(true);
    expect(steps.find((s) => s.estado === 'EN_REPARACION')?.isCompleted).toBe(false);
  });

  it('completa todos los pasos al finalizar', async () => {
    const steps = (await create('FINALIZADA')).componentInstance.steps();
    expect(steps.every((s) => s.isCompleted)).toBe(true);
  });

  it('renderiza el historial de auditoría', async () => {
    const fixture = await create('EN_CAMINO', [
      { estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-01-01T00:00:00Z', motivo: 'creada' },
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Trazabilidad de Auditoría');
    expect(text).toContain('creada');
  });
});
