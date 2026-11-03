import { Rol } from '../core/models/common.models';
import { environment } from '../core/environment/environment';

export interface MenuEntry {
  label: string;
  icon: string;
  routerLink: string;
  roles?: Rol[];
  /**
   * The link points at the user's own panel. Its destination is not static:
   * the caller resolves it with the same `PanelResolver` the topbar uses, so
   * both affordances always lead to the same place. `routerLink` stays as the
   * fallback when the caller has no session to resolve.
   */
  panelPropio?: boolean;
}

export interface MenuSection {
  label: string;
  items: MenuEntry[];
}

const COMISION = Math.round(environment.commissionRate * 100);

const SECTIONS: MenuSection[] = [
  {
    label: 'Cliente',
    items: [
      { label: 'Mis Órdenes', icon: 'pi pi-list-check', routerLink: '/cliente/panel', roles: ['CLIENTE', 'TECNICO'] },
      { label: 'Pedir Técnico', icon: 'pi pi-plus-circle', routerLink: '/cliente/solicitar', roles: ['CLIENTE', 'TECNICO'] },
      { label: 'Mis Equipos', icon: 'pi pi-box', routerLink: '/cliente/equipos', roles: ['CLIENTE', 'TECNICO'] },
    ],
  },
  {
    label: 'Técnico',
    items: [
      { label: 'Mi Perfil', icon: 'pi pi-user', routerLink: '/tecnico/perfil', roles: ['TECNICO'] },
      { label: 'Mi Panel', icon: 'pi pi-th-large', routerLink: '/tecnico/panel', roles: ['TECNICO'], panelPropio: true },
      { label: 'Radar de Ofertas', icon: 'pi pi-compass', routerLink: '/tecnico/ofertas', roles: ['TECNICO'] },
      { label: 'Documentación', icon: 'pi pi-id-card', routerLink: '/tecnico/documentos', roles: ['TECNICO'] },
      { label: `Liquidaciones (${COMISION}%)`, icon: 'pi pi-wallet', routerLink: '/tecnico/liquidaciones', roles: ['TECNICO'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Torre de Control', icon: 'pi pi-chart-bar', routerLink: '/admin/dashboard', roles: ['ADMINISTRADOR', 'CONTABLE'] },
      { label: 'Conciliación', icon: 'pi pi-money-bill', routerLink: '/admin/consignaciones', roles: ['ADMINISTRADOR', 'CONTABLE'] },
      { label: 'Auditoría Técnicos', icon: 'pi pi-verified', routerLink: '/admin/validacion-tecnicos', roles: ['ADMINISTRADOR'] },
      { label: 'Disputas', icon: 'pi pi-shield', routerLink: '/admin/disputas', roles: ['ADMINISTRADOR'] },
      { label: 'Monitoreo OTs', icon: 'pi pi-desktop', routerLink: '/admin/monitoreo', roles: ['ADMINISTRADOR', 'CONTABLE'] },
      { label: 'Proveedores', icon: 'pi pi-truck', routerLink: '/admin/proveedores', roles: ['ADMINISTRADOR'] },
    ],
  },
  {
    label: 'Proveedor',
    items: [
      { label: 'Solicitudes de Insumos', icon: 'pi pi-inbox', routerLink: '/proveedor/panel', roles: ['PROVEEDOR'] },
    ],
  },
];

/**
 * Devuelve las secciones de menú visibles para el conjunto de roles indicado.
 *
 * Un usuario dual (Cliente + Técnico) recibe AMBAS secciones simultáneamente:
 * cada ítem se muestra si alguno de sus roles pertenece al conjunto. No hay
 * selector de "rol activo".
 *
 * `rutaPanelPropio` es el destino ya resuelto por `PanelResolver` para el ítem
 * marcado como `panelPropio`. Sin él, ese ítem conserva su `routerLink` estático.
 */
export function buildMenu(roles: Iterable<Rol> | null, rutaPanelPropio?: string): MenuSection[] {
  if (!roles) return [];
  const set = new Set(roles);
  if (set.size === 0) return [];
  return SECTIONS
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.roles || item.roles.some((rol) => set.has(rol)))
        .map((item) =>
          item.panelPropio && rutaPanelPropio ? { ...item, routerLink: rutaPanelPropio } : item,
        ),
    }))
    .filter((section) => section.items.length > 0);
}
