import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { OrdenActivaComponent } from './orden-activa';

function setup(extra: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
  const fixture = TestBed.createComponent(OrdenActivaComponent);
  const entradas = {
    estado: 'En camino',
    categoria: 'AIRE ACONDICIONADO',
    accion: 'Ver seguimiento',
    ...extra,
  };
  for (const [nombre, valor] of Object.entries(entradas)) {
    fixture.componentRef.setInput(nombre, valor);
  }
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  return { fixture, raiz };
}

describe('cd-orden-activa', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('pinta el estado grande y un solo botón', () => {
    const { raiz } = setup();

    expect(raiz.querySelector('.cd-dato__grande')?.textContent?.trim()).toBe('En camino');
    expect(raiz.querySelectorAll('ion-button')).toHaveLength(1);
    expect(raiz.querySelector('ion-button')?.textContent?.trim()).toBe('Ver seguimiento');
  });

  it('emite al tocar el botón', () => {
    const { fixture, raiz } = setup();
    let veces = 0;
    fixture.componentInstance.accionar.subscribe(() => veces++);

    (raiz.querySelector('[data-testid="orden-activa-accion"]') as HTMLElement).click();

    expect(veces).toBe(1);
  });

  it('omite lo que no llega', () => {
    const { raiz } = setup();

    expect(raiz.textContent).not.toContain('undefined');
    expect(raiz.querySelector('.cd-orden-activa__contexto')).toBeNull();
    expect(raiz.querySelector('.cd-orden-activa__direccion')).toBeNull();
    expect(raiz.querySelector('.cd-ot__codigo')).toBeNull();
    expect(raiz.querySelector('app-priority-chip')).toBeNull();
  });

  it('pinta código, prioridad, contexto y dirección cuando llegan', () => {
    const { raiz } = setup({
      codigo: 'OT-2026-0001',
      prioridad: 'ALTA',
      contexto: ['Lucas Vega', 'Caobos'],
      direccion: 'Calle 15 # 3E-28',
    });

    expect(raiz.textContent).toContain('OT-2026-0001');
    expect(raiz.querySelector('app-priority-chip')?.textContent?.trim()).toBe('Alta');
    expect(raiz.querySelector('.cd-orden-activa__contexto')?.textContent).toContain('Caobos');
    expect(raiz.querySelector('.cd-orden-activa__direccion')?.textContent).toContain('Calle 15');
  });
});
