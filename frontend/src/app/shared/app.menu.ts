import { Rol } from '../core/models/common.models';
import { rolesCon } from '../core/permisos';

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
      { label: 'Torre de Control', icon: 'pi pi-chart-bar', routerLink: '/admin/dashboard', roles: rolesCon('VER_OPERACION') },
      { label: 'Conciliación', icon: 'pi pi-money-bill', routerLink: '/admin/consignaciones', roles: rolesCon('GESTIONAR_CONSIGNACIONES') },
      { label: 'Auditoría Técnicos', icon: 'pi pi-verified', routerLink: '/admin/validacion-tecnicos', roles: rolesCon('VALIDAR_DOCUMENTACION') },
      { label: 'Disputas', icon: 'pi pi-shield', routerLink: '/admin/disputas', roles: rolesCon('GESTIONAR_DISPUTAS') },
      { label: 'Monitoreo OTs', icon: 'pi pi-desktop', routerLink: '/admin/monitoreo', roles: rolesCon('VER_OPERACION') },
      { label: 'Proveedores', icon: 'pi pi-truck', routerLink: '/admin/proveedores', roles: rolesCon('VALIDAR_DOCUMENTACION') },
      { label: 'Cuentas', icon: 'pi pi-users', routerLink: '/admin/cuentas', roles: rolesCon('GESTIONAR_CUENTAS') },
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
