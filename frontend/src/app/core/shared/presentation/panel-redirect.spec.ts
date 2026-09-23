import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PanelRedirectComponent } from './panel-redirect';
import { AuthService } from '../infrastructure/auth/auth.service';
import { Rol, UsuarioResponse } from '../domain/models/common.models';

function usuario(rol: Rol): UsuarioResponse {
  return { id: 1, nombre: 'Test', correo: 't@x.co', rol, habeasDataAceptado: true, activo: true };
}

function setup(user: UsuarioResponse | null) {
  const router = { navigate: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { currentUser: () => user } },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(PanelRedirectComponent);
  fixture.detectChanges();
  return router;
}

describe('PanelRedirectComponent', () => {
  it('redirige al login sin usuario', () => {
    expect(setup(null).navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirige al panel del cliente', () => {
    expect(setup(usuario('CLIENTE')).navigate).toHaveBeenCalledWith(['/cliente/panel']);
  });

  it('redirige al panel del técnico', () => {
    expect(setup(usuario('TECNICO')).navigate).toHaveBeenCalledWith(['/tecnico/panel']);
  });

  it('redirige al dashboard del administrador', () => {
    expect(setup(usuario('ADMINISTRADOR')).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('redirige al dashboard del contable', () => {
    expect(setup(usuario('CONTABLE')).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('redirige a la raíz con un rol desconocido', () => {
    expect(setup(usuario('DESCONOCIDO' as unknown as Rol)).navigate).toHaveBeenCalledWith(['/']);
  });
});
