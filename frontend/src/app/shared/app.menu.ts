import { Rol } from '../core/models/common.models';

export interface MenuEntry {
  label: string;
  icon: string;
  routerLink: string;
  roles?: Rol[];
}

export interface MenuSection {
  label: string;
  items: MenuEntry[];
}

const SECTIONS: MenuSection[] = [
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
];

/** Devuelve las secciones de menú visibles para el conjunto de roles indicado. */
export function buildMenu(roles: Iterable<Rol> | null): MenuSection[] {
  if (!roles) return [];
  const set = new Set(roles);
  if (set.size === 0) return [];
  return SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.some((rol) => set.has(rol))),
    }))
    .filter((section) => section.items.length > 0);
}
