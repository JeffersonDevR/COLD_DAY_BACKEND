import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppSidebar } from './app-sidebar';
import { AuthService } from '../../core/service/auth.service';
import { LayoutService } from '../../core/service/layout.service';
import { Rol } from '../../core/models/common.models';
import {
  CLAVE_PANEL_PREFERIDO,
  resolverPanel,
} from '../../core/navihationError/panel-resolver';

function setup(roles: Rol[] | null) {
  const layout = {
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    overlayMenuActive: () => false,
    mobileMenuOpen: () => false,
    closeOverlays: vi.fn(),
  };
  const rolPrimario = roles?.[0];
  const auth = {
    userRoles: () => new Set<Rol>(roles ?? []),
    currentUser: () => (rolPrimario ? { rol: rolPrimario } : null),
  };
  TestBed.configureTestingModule({
    imports: [AppSidebar],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: LayoutService, useValue: layout },
    ],
  });
  const fixture = TestBed.createComponent(AppSidebar);
  fixture.detectChanges();
  return { fixture, layout };
}

describe('AppSidebar', () => {
  beforeEach(() => window.localStorage.clear());

  it('sin rol no muestra secciones', () => {
    expect(setup(null).fixture.componentInstance.sections()).toEqual([]);
  });

  it('muestra el menú del cliente', () => {
    const { fixture } = setup(['CLIENTE']);
    expect(fixture.componentInstance.sections()[0].label).toBe('Cliente');
    expect(fixture.nativeElement.textContent).toContain('Mis Órdenes');
  });

  it('muestra el menú del técnico', () => {
    const { fixture } = setup(['TECNICO']);
    expect(fixture.nativeElement.textContent).toContain('Radar de Ofertas');
  });

  it('un usuario con doble rol ve las secciones Cliente y Técnico a la vez', () => {
    const { fixture } = setup(['CLIENTE', 'TECNICO']);
    const labels = fixture.componentInstance.sections().map((seccion) => seccion.label);
    expect(labels).toEqual(['Cliente', 'Técnico']);
    expect(fixture.nativeElement.textContent).toContain('Mis Órdenes');
    expect(fixture.nativeElement.textContent).toContain('Radar de Ofertas');
  });

  it('"Mi Panel" lleva al mismo destino que el topbar (preferencia del dual-role)', () => {
    window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/cliente/panel');
    const roles = new Set<Rol>(['CLIENTE', 'TECNICO']);
    const { fixture } = setup(['TECNICO', 'CLIENTE']);

    const miPanel = fixture.componentInstance
      .sections()
      .flatMap((seccion) => seccion.items)
      .find((item) => item.label === 'Mi Panel');

    expect(miPanel?.routerLink).toBe('/cliente/panel');
    // El topbar navega con `resolverPanel(usuario.rol, userRoles())`: misma ruta.
    expect(miPanel?.routerLink).toBe(resolverPanel('TECNICO', roles));
  });

  it('onNavigate cierra los overlays', () => {
    const { fixture, layout } = setup(['CLIENTE']);
    fixture.componentInstance.onNavigate();
    expect(layout.closeOverlays).toHaveBeenCalled();
  });

  it('isStatic refleja el modo de menú', () => {
    const { fixture } = setup(['ADMINISTRADOR']);
    expect(fixture.componentInstance.isStatic()).toBe(true);
  });
});
