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

  it('con doble rol usa el panel del rol primario', () => {
    expect(setup(usuario('CLIENTE'), ['CLIENTE', 'TECNICO']).navigate).toHaveBeenCalledWith(['/cliente/panel']);
  });

  it('con rol primario no enrutable cae al primer rol enrutable del conjunto', () => {
    expect(
      setup(usuario('DESCONOCIDO' as unknown as Rol), ['DESCONOCIDO' as Rol, 'TECNICO']).navigate,
    ).toHaveBeenCalledWith(['/tecnico/panel']);
  });

  it('redirige a la raíz con un rol desconocido', () => {
    expect(setup(usuario('DESCONOCIDO' as unknown as Rol)).navigate).toHaveBeenCalledWith(['/']);
  });
});
