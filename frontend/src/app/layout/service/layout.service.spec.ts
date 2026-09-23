import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout.service';

const STORAGE_KEY = 'coldday.layout';

describe('LayoutService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('arranca con los valores por defecto', () => {
    const service = TestBed.inject(LayoutService);
    expect(service.menuMode()).toBe('static');
    expect(service.sidebarCollapsed()).toBe(false);
    expect(service.mobileMenuOpen()).toBe(false);
    expect(service.overlayMenuActive()).toBe(false);
  });

  it('toggleMenu colapsa la sidebar en modo static y persiste', () => {
    const service = TestBed.inject(LayoutService);
    service.toggleMenu();
    expect(service.sidebarCollapsed()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      menuMode: 'static',
      sidebarCollapsed: true,
    });
  });

  it('toggleMenu alterna el overlay en modo overlay', () => {
    const service = TestBed.inject(LayoutService);
    service.setMenuMode('overlay');
    service.toggleMenu();
    expect(service.overlayMenuActive()).toBe(true);
    service.toggleMenu();
    expect(service.overlayMenuActive()).toBe(false);
  });

  it('toggleMobileMenu y closeOverlays controlan el drawer', () => {
    const service = TestBed.inject(LayoutService);
    service.toggleMobileMenu();
    service.setMenuMode('overlay');
    service.toggleMenu();
    expect(service.mobileMenuOpen()).toBe(true);
    expect(service.overlayMenuActive()).toBe(true);

    service.closeOverlays();
    expect(service.mobileMenuOpen()).toBe(false);
    expect(service.overlayMenuActive()).toBe(false);
  });

  it('setMenuMode resetea el overlay y persiste', () => {
    const service = TestBed.inject(LayoutService);
    service.toggleMenu();
    service.setMenuMode('overlay');
    expect(service.menuMode()).toBe('overlay');
    expect(service.overlayMenuActive()).toBe(false);
  });

  it('setSidebarCollapsed persiste el valor', () => {
    const service = TestBed.inject(LayoutService);
    service.setSidebarCollapsed(true);
    expect(service.sidebarCollapsed()).toBe(true);
  });

  it('restaura las preferencias guardadas', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ menuMode: 'overlay', sidebarCollapsed: true }));
    const service = TestBed.inject(LayoutService);
    expect(service.menuMode()).toBe('overlay');
    expect(service.sidebarCollapsed()).toBe(true);
  });

  it('ignora preferencias corruptas', () => {
    window.localStorage.setItem(STORAGE_KEY, '{no-json');
    const service = TestBed.inject(LayoutService);
    expect(service.menuMode()).toBe('static');
  });
});
