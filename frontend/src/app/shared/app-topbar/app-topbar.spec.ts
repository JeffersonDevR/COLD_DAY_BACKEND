import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppTopbar } from './app-topbar';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { LayoutService } from '../../core/service/layout.service';
import { CLAVE_PANEL_PREFERIDO } from '../../core/navihationError/panel-resolver';
import { Rol, UsuarioResponse } from '../../core/models/common.models';

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'María Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function setup(user: UsuarioResponse | null, roles?: Set<Rol>) {
  const layout = {
    toggleMobileMenu: vi.fn(),
    toggleMenu: vi.fn(),
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    setMenuMode: vi.fn(),
    setSidebarCollapsed: vi.fn(),
  };
  const auth = {
    currentUser: () => user,
    userRoles: () => roles ?? (user?.rol ? new Set<Rol>([user.rol as Rol]) : new Set<Rol>()),
    logout: vi.fn(),
  };
  const toast = { success: vi.fn() };

  TestBed.configureTestingModule({
    imports: [AppTopbar],
    providers: [
      provideRouter([]),
      { provide: LayoutService, useValue: layout },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AppTopbar);
  fixture.detectChanges();
  return { fixture, layout, auth, toast, navigate };
}

describe('AppTopbar', () => {
  beforeEach(() => window.localStorage.clear());

  it('calcula las iniciales del usuario', () => {
    expect(setup(usuario).fixture.componentInstance.iniciales()).toBe('MG');
  });

  it('sin nombre usa el correo de la sesión como rótulo y saca de ahí las iniciales', () => {
    const { fixture } = setup({ ...usuario, nombre: '' });
    expect(fixture.componentInstance.nombreVisible()).toBe('maria.gomez@gmail.com');
    expect(fixture.componentInstance.iniciales()).toBe('M');
  });

  it('sin nombre ni correo muestra un rótulo neutro y nunca deja la etiqueta en blanco', () => {
    // JWT real recargado: sin claims `nombre`/`correo`. El rótulo no puede quedar
    // vacío ni inventar un nombre de persona.
    const { fixture } = setup({ ...usuario, nombre: '', correo: '' });
    expect(fixture.componentInstance.nombreVisible()).toBe('Usuario');
    expect(fixture.componentInstance.iniciales()).toBe('U');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Usuario');
  });

  it('la fila de identidad del menú muestra el correo de la cuenta', () => {
    const items = setup(usuario).fixture.componentInstance.userMenuItems();
    expect(items[0].label).toBe('maria.gomez@gmail.com');
  });

  it('la fila de identidad del menú nunca queda en blanco sin claims', () => {
    // JWT real recargado: sin claims `nombre`/`correo`.
    const items = setup({ ...usuario, nombre: '', correo: '' }).fixture.componentInstance.userMenuItems();
    expect(items[0].label).toBe('Usuario');
  });

  it('sin sesión mantiene un rótulo e iniciales neutras', () => {
    const { fixture } = setup(null);
    expect(fixture.componentInstance.nombreVisible()).toBe('Usuario');
    expect(fixture.componentInstance.iniciales()).toBe('U');
  });

  it('construye el menú de usuario con el correo', () => {
    const items = setup(usuario).fixture.componentInstance.userMenuItems();
    expect(items[0].label).toBe('maria.gomez@gmail.com');
    expect(items.some((i) => i.label === 'Cerrar Sesión')).toBe(true);
  });

  it('cerrarSesion limpia la sesión, avisa y navega', () => {
    const { fixture, auth, toast, navigate } = setup(usuario);
    fixture.componentInstance.cerrarSesion();
    expect(auth.logout).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('delega el toggle de menú desde el botón de escritorio', () => {
    const { fixture, layout } = setup(usuario);
    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    botones[1].click();
    expect(layout.toggleMenu).toHaveBeenCalled();
  });

  it('no expone el configurador ni el conmutador de modo oscuro', () => {
    const { fixture } = setup(usuario);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[aria-label="Personalizar tema"]')).toBeNull();
    expect(host.querySelector('[aria-label="Modo oscuro"], [aria-label="Modo claro"]')).toBeNull();
  });

  it('con rol TECNICO, "Mi Panel" lleva al panel del técnico', () => {
    const { fixture, navigate } = setup({ ...usuario, rol: 'TECNICO' }, new Set<Rol>(['TECNICO']));
    const item = fixture.componentInstance.userMenuItems().find((i) => i.label === 'Ir a Mi Panel');
    (item?.command as (() => void) | undefined)?.();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/panel']);
  });

  it('con rol CLIENTE, "Mi Panel" lleva al panel del cliente', () => {
    const { fixture, navigate } = setup(usuario);
    const item = fixture.componentInstance.userMenuItems().find((i) => i.label === 'Ir a Mi Panel');
    (item?.command as (() => void) | undefined)?.();
    expect(navigate).toHaveBeenCalledWith(['/cliente/panel']);
  });

  it('con doble rol, "Mi Panel" respeta el último panel visitado', () => {
    window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/tecnico/panel');
    const { fixture, navigate } = setup(usuario, new Set<Rol>(['CLIENTE', 'TECNICO']));

    const item = fixture.componentInstance.userMenuItems().find((i) => i.label === 'Ir a Mi Panel');
    (item?.command as (() => void) | undefined)?.();

    expect(navigate).toHaveBeenCalledWith(['/tecnico/panel']);
  });
});
