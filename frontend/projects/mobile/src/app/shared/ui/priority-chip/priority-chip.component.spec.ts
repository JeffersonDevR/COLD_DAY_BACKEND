import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Prioridad } from '@core/models/common.models';
import { PriorityChipComponent } from './priority-chip.component';

function crear(prioridad?: Prioridad): ComponentFixture<PriorityChipComponent> {
  TestBed.configureTestingModule({ imports: [PriorityChipComponent] });
  const fixture = TestBed.createComponent(PriorityChipComponent);
  if (prioridad !== undefined) fixture.componentRef.setInput('prioridad', prioridad);
  fixture.detectChanges();
  return fixture;
}

function chip(fixture: ComponentFixture<PriorityChipComponent>): HTMLElement {
  return fixture.nativeElement.querySelector('span');
}

describe('PriorityChipComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra Alta con el tono de peligro y su data-testid', () => {
    const span = chip(crear('ALTA'));

    expect(span.textContent?.trim()).toBe('Alta');
    expect(span.classList).toContain('cd-chip');
    expect(span.classList).toContain('cd-chip--cerrada');
    expect(span.getAttribute('data-testid')).toBe('prioridad-chip');
  });

  it('muestra Media con el tono de acción', () => {
    const span = chip(crear('MEDIA'));

    expect(span.textContent?.trim()).toBe('Media');
    expect(span.classList).toContain('cd-chip--curso');
  });

  it('muestra Baja con el tono de éxito', () => {
    const span = chip(crear('BAJA'));

    expect(span.textContent?.trim()).toBe('Baja');
    expect(span.classList).toContain('cd-chip--ok');
  });

  it('usa Media por defecto cuando no llega el dato', () => {
    const span = chip(crear());

    expect(span.textContent?.trim()).toBe('Media');
    expect(span.classList).toContain('cd-chip--curso');
  });
});
