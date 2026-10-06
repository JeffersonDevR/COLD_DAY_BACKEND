import { TestBed } from '@angular/core/testing';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  async function create(abierto = true, danger = false) {
    await TestBed.configureTestingModule({ imports: [ConfirmDialog] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('title', 'Eliminar registro');
    fixture.componentRef.setInput('message', '¿Seguro que deseas continuar?');
    fixture.componentRef.setInput('isOpen', abierto);
    fixture.componentRef.setInput('isDanger', danger);
    fixture.detectChanges();
    return fixture;
  }

  it('renderiza el mensaje cuando está abierto', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('¿Seguro que deseas continuar?');
  });

  it('emite confirmed al confirmar', async () => {
    const fixture = await create();
    let confirmado = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmado = true));

    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(botones.length).toBeGreaterThanOrEqual(2);
    botones[botones.length - 1].click();

    expect(confirmado).toBe(true);
  });

  it('emite canceled al cancelar', async () => {
    const fixture = await create();
    let cancelado = false;
    fixture.componentInstance.canceled.subscribe(() => (cancelado = true));

    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    botones[0].click();

    expect(cancelado).toBe(true);
  });
});
