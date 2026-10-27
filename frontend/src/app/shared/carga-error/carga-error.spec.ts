import { TestBed } from '@angular/core/testing';
import { CargaError } from './carga-error';

describe('CargaError', () => {
  async function create(mensaje?: string) {
    await TestBed.configureTestingModule({ imports: [CargaError] }).compileComponents();
    const fixture = TestBed.createComponent(CargaError);
    if (mensaje) fixture.componentRef.setInput('mensaje', mensaje);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra el mensaje como alerta con botón Reintentar', async () => {
    const fixture = await create('No pudimos cargar las liquidaciones.');
    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;

    expect(alerta.textContent).toContain('No pudimos cargar las liquidaciones.');
    expect(alerta.querySelector('button')?.textContent?.trim()).toBe('Reintentar');
  });

  it('usa una copy neutra por defecto', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los datos.');
  });

  it('emite reintentar al hacer clic', async () => {
    const fixture = await create();
    const emitido = vi.fn();
    fixture.componentInstance.reintentar.subscribe(emitido);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(emitido).toHaveBeenCalledTimes(1);
  });
});
