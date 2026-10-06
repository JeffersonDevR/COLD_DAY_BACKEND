import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  async function create(actionLabel = '') {
    await TestBed.configureTestingModule({ imports: [EmptyState] }).compileComponents();
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Sin resultados');
    fixture.componentRef.setInput('description', 'No hay datos para mostrar');
    if (actionLabel) {
      fixture.componentRef.setInput('actionLabel', actionLabel);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('renderiza título y descripción', async () => {
    const fixture = await create();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sin resultados');
    expect(text).toContain('No hay datos para mostrar');
  });

  it('no muestra botón sin actionLabel', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('emite actionClicked al pulsar la acción', async () => {
    const fixture = await create('Crear');
    let emitido = false;
    fixture.componentInstance.actionClicked.subscribe(() => (emitido = true));

    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(boton).not.toBeNull();
    boton.click();

    expect(emitido).toBe(true);
  });
});
