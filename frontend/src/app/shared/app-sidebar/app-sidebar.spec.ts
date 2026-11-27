import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppSidebar } from './app-sidebar';
import { AuthService } from '../../core/service/auth.service';
import { LayoutService } from '../../core/service/layout.service';
import { Rol } from '../../core/models/common.models';

function setup(roles: Rol[] | null) {
  const layout = {
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    overlayMenuActive: () => false,
    mobileMenuOpen: () => false,
    closeOverlays: vi.fn(),
  };
  const auth = {
    userRoles: () => new Set<Rol>(roles ?? []),
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

  it('quien no es interno no ve secciones', () => {
    expect(setup(['CLIENTE', 'TECNICO']).fixture.componentInstance.sections()).toEqual([]);
  });

  it('muestra el menú de administración', () => {
    const { fixture } = setup(['ADMINISTRADOR']);
    expect(fixture.componentInstance.sections().map((s) => s.label)).toEqual(['Administración']);
    expect(fixture.nativeElement.textContent).toContain('Torre de Control');
  });

  it('onNavigate cierra los overlays', () => {
    const { fixture, layout } = setup(['ADMINISTRADOR']);
    fixture.componentInstance.onNavigate();
    expect(layout.closeOverlays).toHaveBeenCalled();
  });

  it('isStatic refleja el modo de menú', () => {
    const { fixture } = setup(['ADMINISTRADOR']);
    expect(fixture.componentInstance.isStatic()).toBe(true);
  });
});
