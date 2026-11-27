import { TestBed } from '@angular/core/testing';
import { UsaLaAppPage } from './usa-la-app-page';
import { AuthService } from '../../core/service/auth.service';

function setup() {
  const auth = { logout: vi.fn() };
  TestBed.configureTestingModule({
    imports: [UsaLaAppPage],
    providers: [{ provide: AuthService, useValue: auth }],
  });
  const fixture = TestBed.createComponent(UsaLaAppPage);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, auth };
}

describe('UsaLaAppPage', () => {
  it('explica que la cuenta se usa desde la app', () => {
    const { el } = setup();

    expect(el.textContent).toContain('Usa la app de Cold Day');
    expect(el.textContent).toContain('Esta web es solo para el equipo interno.');
  });

  it('cierra la sesión desde el botón', () => {
    const { el, auth } = setup();
    const boton = el.querySelector('button')!;
    expect(boton.textContent).toContain('Cerrar sesión');

    boton.click();

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
