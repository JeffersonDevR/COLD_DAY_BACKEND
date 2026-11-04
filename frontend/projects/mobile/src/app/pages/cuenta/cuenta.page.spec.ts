import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { signal } from '@angular/core';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { AuthService } from '@core/service/auth.service';
import { UsuarioResponse } from '@core/models/common.models';
import { ModoApp } from '../../modo/modo';
import { ModoService } from '../../modo/modo.service';
import { CuentaPage } from './cuenta.page';

// Cuenta usa el check del modo activo; sin registro, ion-icon intenta bajar el SVG.
addIcons({ checkmarkCircleOutline });

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'María Gómez',
  correo: 'maria@coldday.co',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function setup(opts: { disponibles: ModoApp[]; actual: ModoApp | null }) {
  const auth = { currentUser: signal(usuario), logout: vi.fn() };
  const modos = {
    modoActual: signal<ModoApp | null>(opts.actual),
    modosDisponibles: signal<ModoApp[]>(opts.disponibles),
    cambiarModo: vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular(),
      { provide: AuthService, useValue: auth },
      { provide: ModoService, useValue: modos },
    ],
  });

  const fixture: ComponentFixture<CuentaPage> = TestBed.createComponent(CuentaPage);
  fixture.detectChanges();
  return { fixture, auth, modos };
}

const boton = (fixture: ComponentFixture<CuentaPage>, testId: string) =>
  fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;

describe('CuentaPage', () => {
  it('muestra el nombre y el correo de la sesión', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    expect(fixture.nativeElement.textContent).toContain('María Gómez');
    expect(fixture.nativeElement.textContent).toContain('maria@coldday.co');
  });

  it('marca el modo actual y deshabilita los perfiles que la cuenta no tiene', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    expect(boton(fixture, 'modo-cliente').getAttribute('aria-pressed')).toBe('true');
    expect(boton(fixture, 'modo-cliente').disabled).toBe(false);
    expect(boton(fixture, 'modo-tecnico').disabled).toBe(true);
    expect(boton(fixture, 'modo-proveedor').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No disponible');
  });

  it('permite cambiar a un perfil disponible', () => {
    const { fixture, modos } = setup({
      disponibles: ['CLIENTE', 'TECNICO'],
      actual: 'CLIENTE',
    });

    boton(fixture, 'modo-tecnico').click();

    expect(modos.cambiarModo).toHaveBeenCalledWith('TECNICO');
  });

  it('cerrar sesión delega en AuthService', () => {
    const { fixture, auth } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    boton(fixture, 'salir').click();

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('sin nombre usa el correo como identidad visible', () => {
    TestBed.resetTestingModule();
    const auth = { currentUser: signal({ ...usuario, nombre: '' }), logout: vi.fn() };
    const modos = {
      modoActual: signal<ModoApp | null>('CLIENTE'),
      modosDisponibles: signal<ModoApp[]>(['CLIENTE']),
      cambiarModo: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        { provide: AuthService, useValue: auth },
        { provide: ModoService, useValue: modos },
      ],
    });
    const fixture = TestBed.createComponent(CuentaPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('maria@coldday.co');
    expect(
      fixture.nativeElement.querySelector('[data-testid="cuenta-nombre"]').textContent,
    ).toContain('maria@coldday.co');
  });
});
