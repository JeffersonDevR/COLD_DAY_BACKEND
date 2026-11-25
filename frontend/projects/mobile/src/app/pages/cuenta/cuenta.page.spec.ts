import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { signal } from '@angular/core';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  constructOutline,
  cubeOutline,
  homeOutline,
  logOutOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/service/auth.service';
import { Rol, UsuarioResponse } from '@core/models/common.models';
import { ModoApp } from '../../modo/modo';
import { ModoService } from '../../modo/modo.service';
import { CuentaPage } from './cuenta.page';

// Sin registro, ion-icon intenta bajar el SVG y ensucia la salida del runner.
addIcons({
  checkmarkCircleOutline,
  constructOutline,
  cubeOutline,
  homeOutline,
  logOutOutline,
  refreshOutline,
});

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'María Gómez',
  correo: 'maria@coldday.co',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function setup(
  opts: {
    disponibles: ModoApp[];
    actual: ModoApp | null;
    rolPrimario?: Rol;
    nombre?: string;
  },
) {
  const auth = {
    currentUser: signal({ ...usuario, nombre: opts.nombre ?? usuario.nombre }),
    userRole: signal<Rol>(opts.rolPrimario ?? 'CLIENTE'),
    logout: vi.fn(),
  };
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

const texto = (fixture: ComponentFixture<CuentaPage>, testId: string): string =>
  (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)
    ?.textContent ?? '';

describe('CuentaPage', () => {
  it('muestra el nombre y el correo de la sesión', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    expect(fixture.nativeElement.textContent).toContain('María Gómez');
    expect(fixture.nativeElement.textContent).toContain('maria@coldday.co');
  });

  it('marca el modo actual y deshabilita los perfiles que la cuenta no tiene', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE', 'PROVEEDOR'], actual: 'CLIENTE' });

    expect(boton(fixture, 'modo-cliente').getAttribute('aria-pressed')).toBe('true');
    expect(boton(fixture, 'modo-cliente').disabled).toBe(false);
    expect(boton(fixture, 'modo-tecnico').disabled).toBe(true);
    expect(boton(fixture, 'modo-proveedor').disabled).toBe(false);
    expect(texto(fixture, 'modo-bloqueado-tecnico')).toContain('Pídelo al admin');
  });

  it('un cliente puro no ve el selector de modo ni la sección de agregar perfil', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    expect(fixture.nativeElement.querySelector('[data-testid="modo-cliente"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cuenta-perfiles-habilitados"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cuenta-agregar-perfil"]')).toBeNull();
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
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE', nombre: '' });

    expect(fixture.nativeElement.textContent).toContain('maria@coldday.co');
    expect(
      fixture.nativeElement.querySelector('[data-testid="cuenta-nombre"]').textContent,
    ).toContain('maria@coldday.co');
  });

  it('quien no se registró como técnico no puede pedir perfiles desde la app', () => {
    const { fixture } = setup({
      disponibles: ['CLIENTE', 'PROVEEDOR'],
      actual: 'CLIENTE',
      rolPrimario: 'CLIENTE',
    });

    // El selector existe (hay 2 perfiles), pero la solicitud es solo del técnico.
    expect(fixture.nativeElement.querySelector('[data-testid="modo-cliente"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="cuenta-agregar-perfil"]')).toBeNull();
  });

  it('el técnico ve sus perfiles sin la nota de gating del administrador', () => {
    const { fixture } = setup({
      disponibles: ['TECNICO', 'PROVEEDOR'],
      actual: 'TECNICO',
      rolPrimario: 'TECNICO',
    });

    expect(fixture.nativeElement.querySelector('[data-testid="cuenta-gating"]')).toBeNull();
    expect(texto(fixture, 'modo-bloqueado-cliente')).toContain('Pídelo al admin');
  });

  it('el técnico llega a su perfil (especialidades) desde Cuenta', () => {
    const { fixture } = setup({
      disponibles: ['TECNICO'],
      actual: 'TECNICO',
      rolPrimario: 'TECNICO',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    boton(fixture, 'cuenta-perfil-tecnico').click();

    expect(navigate).toHaveBeenCalledWith(['/tecnico/perfil']);
  });

  it('el cliente no ve el acceso al perfil técnico', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE'], actual: 'CLIENTE' });

    expect(boton(fixture, 'cuenta-perfil-tecnico')).toBeNull();
  });

  it('un técnico al que le faltan perfiles no ve Agregar perfil ni el formulario de solicitud', () => {
    const { fixture } = setup({
      disponibles: ['TECNICO'],
      actual: 'TECNICO',
      rolPrimario: 'TECNICO',
    });
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('[data-testid="cuenta-agregar-perfil"]')).toBeNull();
    expect(html.querySelector('[data-testid="formulario-perfil"]')).toBeNull();
    expect(html.querySelector('[data-testid="solicitar-perfil"]')).toBeNull();
    expect(html.textContent).not.toContain('Agregar perfil');
  });

  it('muestra cuántos perfiles tiene habilitados la cuenta', () => {
    const { fixture } = setup({ disponibles: ['CLIENTE', 'TECNICO'], actual: 'CLIENTE' });

    expect(texto(fixture, 'cuenta-perfiles-habilitados')).toContain('2 de 3 perfiles habilitados');
  });

  it('con los tres perfiles habilitados el conteo dice 3 de 3', () => {
    const { fixture } = setup({
      disponibles: ['CLIENTE', 'TECNICO', 'PROVEEDOR'],
      actual: 'PROVEEDOR',
    });

    expect(texto(fixture, 'cuenta-perfiles-habilitados')).toContain('3 de 3 perfiles habilitados');
  });
});
