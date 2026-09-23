import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppTopbar } from './app-topbar';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { ThemeService } from '../../core/shared/presentation/theme.service';
import { ToastService } from '../../core/shared/presentation/toast.service';
import { LayoutService } from '../service/layout.service';
import { UsuarioResponse } from '../../core/shared/domain/models/common.models';

const usuario: UsuarioResponse = {
  id: 3,
  nombre: 'María Gómez',
  correo: 'maria.gomez@gmail.com',
  rol: 'CLIENTE',
  habeasDataAceptado: true,
  activo: true,
};

function setup(user: UsuarioResponse | null) {
  const layout = {
    toggleMobileMenu: vi.fn(),
    toggleMenu: vi.fn(),
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    setMenuMode: vi.fn(),
    setSidebarCollapsed: vi.fn(),
  };
  const theme = {
    isDark: () => false,
    toggleTheme: vi.fn(),
    primaryColors: () => [],
    primary: () => 'sky',
    surfaces: [],
    surface: () => 'slate',
    preset: () => 'Aura',
    setPrimary: vi.fn(),
    setSurface: vi.fn(),
    setPreset: vi.fn(),
    setTheme: vi.fn(),
  };
  const auth = { currentUser: () => user, logout: vi.fn() };
  const toast = { success: vi.fn() };

  TestBed.configureTestingModule({
    imports: [AppTopbar],
    providers: [
      provideRouter([]),
      { provide: LayoutService, useValue: layout },
      { provide: ThemeService, useValue: theme },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AppTopbar);
  fixture.detectChanges();
  return { fixture, layout, theme, auth, toast, navigate };
}

describe('AppTopbar', () => {
  it('calcula las iniciales del usuario', () => {
    expect(setup(usuario).fixture.componentInstance.iniciales()).toBe('MG');
  });

  it('usa "?" sin usuario', () => {
    expect(setup(null).fixture.componentInstance.iniciales()).toBe('?');
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

  it('delega el toggle de menú y de tema desde los botones', () => {
    const { fixture, layout, theme } = setup(usuario);
    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    botones[1].click();
    botones[2].click();
    expect(layout.toggleMenu).toHaveBeenCalled();
    expect(theme.toggleTheme).toHaveBeenCalled();
  });
});
