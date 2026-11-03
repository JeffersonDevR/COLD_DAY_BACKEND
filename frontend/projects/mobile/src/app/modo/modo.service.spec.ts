import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '@core/service/auth.service';
import { Rol } from '@core/models/common.models';
import { CLAVE_MODO, ModoService } from './modo.service';

function fakeAuth(roles: Rol[]) {
  return { userRoles: signal(new Set<Rol>(roles)) };
}

function setup(roles: Rol[]) {
  const router = { navigateByUrl: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: fakeAuth(roles) },
      { provide: Router, useValue: router },
    ],
  });
  return { service: TestBed.inject(ModoService), router };
}

describe('ModoService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sin roles no hay modo disponible ni home', () => {
    const { service } = setup([]);

    expect(service.modosDisponibles()).toEqual([]);
    expect(service.modoActual()).toBeNull();
    expect(service.homeActual()).toBeNull();
  });

  it('elige el modo por prioridad cuando el usuario tiene varios perfiles', () => {
    const { service } = setup(['PROVEEDOR', 'TECNICO', 'CLIENTE']);

    expect(service.modosDisponibles()).toEqual(['CLIENTE', 'TECNICO', 'PROVEEDOR']);
    expect(service.modoActual()).toBe('CLIENTE');
    expect(service.homeActual()).toBe('/cliente/panel');
  });

  it('usa el modo persistido si sigue disponible', () => {
    window.localStorage.setItem(CLAVE_MODO, 'TECNICO');
    const { service } = setup(['CLIENTE', 'TECNICO']);

    expect(service.modoActual()).toBe('TECNICO');
    expect(service.homeActual()).toBe('/tecnico/radar');
  });

  it('ignora un modo persistido que la cuenta ya no tiene', () => {
    window.localStorage.setItem(CLAVE_MODO, 'PROVEEDOR');
    const { service } = setup(['CLIENTE']);

    expect(service.modoActual()).toBe('CLIENTE');
  });

  it('ignora un valor inválido del storage', () => {
    window.localStorage.setItem(CLAVE_MODO, 'ADMINISTRADOR');
    const { service } = setup(['TECNICO']);

    expect(service.modoActual()).toBe('TECNICO');
  });

  it('cambiarModo persiste y navega al home del modo', () => {
    const { service, router } = setup(['CLIENTE', 'TECNICO']);

    service.cambiarModo('TECNICO');

    expect(service.modoActual()).toBe('TECNICO');
    expect(window.localStorage.getItem(CLAVE_MODO)).toBe('TECNICO');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tecnico/radar');
  });

  it('cambiarModo ignora un modo que la cuenta no tiene', () => {
    const { service, router } = setup(['CLIENTE']);

    service.cambiarModo('PROVEEDOR');

    expect(service.modoActual()).toBe('CLIENTE');
    expect(window.localStorage.getItem(CLAVE_MODO)).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
