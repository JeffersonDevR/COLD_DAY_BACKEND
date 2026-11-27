import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PanelRedirectComponent } from './panel-redirect';
import { AuthService } from '../service/auth.service';
import { Rol, UsuarioResponse } from '../models/common.models';

function usuario(rol: Rol): UsuarioResponse {
  return { id: 1, nombre: 'Test', correo: 't@x.co', rol, habeasDataAceptado: true, activo: true };
}

function setup(user: UsuarioResponse | null, roles?: Rol[]) {
  const router = { navigate: vi.fn() };
  const effective = new Set<Rol>(roles ?? (user ? [user.rol] : []));
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { currentUser: () => user, userRoles: () => effective } },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(PanelRedirectComponent);
  fixture.detectChanges();
  return router;
}

describe('PanelRedirectComponent', () => {
  beforeEach(() => window.localStorage.clear());

  it('redirige al login sin usuario', () => {
    expect(setup(null).navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirige al dashboard del administrador', () => {
    expect(setup(usuario('ADMINISTRADOR')).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('redirige al dashboard del contable', () => {
    expect(setup(usuario('CONTABLE')).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('manda a la pantalla de la app a quien no es interno', () => {
    expect(setup(usuario('CLIENTE'), ['CLIENTE', 'TECNICO']).navigate).toHaveBeenCalledWith(['/usa-la-app']);
  });
});
