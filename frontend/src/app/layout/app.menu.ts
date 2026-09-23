import { Rol } from '../core/shared/domain/models/common.models';
import { environment } from '../../environments/environment';

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

const COMISION = Math.round(environment.commissionRate * 100);

const SECTIONS: MenuSection[] = [
  {
    label: 'Cliente',
    items: [
      { label: 'Mis Órdenes', icon: 'pi pi-list-check', routerLink: '/cliente/panel', roles: ['CLIENTE'] },
      { label: 'Pedir Técnico', icon: 'pi pi-plus-circle', routerLink: '/cliente/solicitar', roles: ['CLIENTE'] },
      { label: 'Mis Equipos', icon: 'pi pi-box', routerLink: '/cliente/equipos', roles: ['CLIENTE'] },
    ],
  },
  {
    label: 'Técnico',
    items: [
      { label: 'Mi Panel', icon: 'pi pi-th-large', routerLink: '/tecnico/panel', roles: ['TECNICO'] },
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

/** Devuelve las secciones de menú visibles para el rol indicado. */
export function buildMenu(rol: Rol | null): MenuSection[] {
  if (!rol) return [];
  return SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(rol)),
    }))
    .filter((section) => section.items.length > 0);
}
