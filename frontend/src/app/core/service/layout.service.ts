import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type MenuMode = 'static' | 'overlay';

interface LayoutPrefs {
  menuMode: MenuMode;
  sidebarCollapsed: boolean;
}

const STORAGE_KEY = 'coldday.layout';

/**
 * Estado del layout tipo Sakai: modo de menú (estático/overlay), barra lateral
 * colapsable en escritorio y drawer en móvil. Se persiste en localStorage.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sidebar reducida a iconos (solo en modo estático). */
  readonly sidebarCollapsed = signal(false);

  /** Drawer lateral abierto en móvil. */
  readonly mobileMenuOpen = signal(false);

  /** Modo de menú: estático (empuja el contenido) u overlay (flota encima). */
  readonly menuMode = signal<MenuMode>('static');

  /** Sidebar overlay abierta en escritorio (solo modo overlay). */
  readonly overlayMenuActive = signal(false);

  constructor() {
    if (this.isBrowser) {
      this.restore();
    }
  }

  /** Botón de menú del topbar en escritorio: colapsa (estático) o abre overlay. */
  toggleMenu(): void {
    if (this.menuMode() === 'overlay') {
      this.overlayMenuActive.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
      this.persist();
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeOverlays(): void {
    this.mobileMenuOpen.set(false);
    this.overlayMenuActive.set(false);
  }

  setMenuMode(mode: MenuMode): void {
    this.menuMode.set(mode);
    this.overlayMenuActive.set(false);
    this.persist();
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    this.persist();
  }

  private restore(): void {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const prefs = JSON.parse(raw) as Partial<LayoutPrefs>;
      this.sidebarCollapsed.set(!!prefs.sidebarCollapsed);
      this.menuMode.set(prefs.menuMode === 'overlay' ? 'overlay' : 'static');
    } catch {
      // Preferencias corruptas: se mantienen los valores por defecto.
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    const prefs: LayoutPrefs = {
      menuMode: this.menuMode(),
      sidebarCollapsed: this.sidebarCollapsed(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }
}
