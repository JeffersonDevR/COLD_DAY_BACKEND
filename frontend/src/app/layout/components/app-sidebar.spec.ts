import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppSidebar } from './app-sidebar';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { LayoutService } from '../service/layout.service';
import { Rol } from '../../core/shared/domain/models/common.models';

function setup(rol: Rol | null) {
  const layout = {
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    overlayMenuActive: () => false,
    mobileMenuOpen: () => false,
    closeOverlays: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [AppSidebar],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { userRole: () => rol } },
      { provide: LayoutService, useValue: layout },
    ],
  });
  const fixture = TestBed.createComponent(AppSidebar);
  fixture.detectChanges();
  return { fixture, layout };
}

describe('AppSidebar', () => {
  it('sin rol no muestra secciones', () => {
    expect(setup(null).fixture.componentInstance.sections()).toEqual([]);
  });

  it('muestra el menú del cliente', () => {
    const { fixture } = setup('CLIENTE');
    expect(fixture.componentInstance.sections()[0].label).toBe('Cliente');
    expect(fixture.nativeElement.textContent).toContain('Mis Órdenes');
  });

  it('muestra el menú del técnico', () => {
    const { fixture } = setup('TECNICO');
    expect(fixture.nativeElement.textContent).toContain('Radar de Ofertas');
  });

  it('onNavigate cierra los overlays', () => {
    const { fixture, layout } = setup('CLIENTE');
    fixture.componentInstance.onNavigate();
    expect(layout.closeOverlays).toHaveBeenCalled();
  });

  it('isStatic refleja el modo de menú', () => {
    const { fixture } = setup('ADMINISTRADOR');
    expect(fixture.componentInstance.isStatic()).toBe(true);
  });
});
