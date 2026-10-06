import { TestBed } from '@angular/core/testing';
import { Loader } from './loader';

describe('Loader', () => {
  async function create(label?: string) {
    await TestBed.configureTestingModule({ imports: [Loader] }).compileComponents();
    const fixture = TestBed.createComponent(Loader);
    if (label !== undefined) {
      fixture.componentRef.setInput('label', label);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('usa la etiqueta por defecto', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.label()).toBe('Cargando datos...');
    expect(fixture.nativeElement.textContent).toContain('Cargando datos...');
  });

  it('muestra la etiqueta personalizada', async () => {
    const fixture = await create('Buscando técnicos');
    expect(fixture.nativeElement.textContent).toContain('Buscando técnicos');
  });

  it('oculta la etiqueta si está vacía', async () => {
    const fixture = await create('');
    expect(fixture.nativeElement.querySelector('span')).toBeNull();
  });
});
