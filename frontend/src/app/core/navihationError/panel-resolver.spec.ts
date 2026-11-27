import { Rol } from '../models/common.models';
import {
  CLAVE_PANEL_PREFERIDO,
  recordarPanel,
  resolverPanel,
  RUTAS_PANEL,
  rutaDePanel,
} from './panel-resolver';

describe('panel-resolver', () => {
  beforeEach(() => window.localStorage.clear());

  describe('resolverPanel', () => {
    it('ignora una preferencia guardada de una pantalla retirada', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/cliente/panel');

      expect(resolverPanel('ADMINISTRADOR', new Set<Rol>(['ADMINISTRADOR']))).toBe('/admin/dashboard');
    });

    it('los roles sin panel interno van a la pantalla de la app', () => {
      for (const rol of ['CLIENTE', 'TECNICO', 'PROVEEDOR'] as Rol[]) {
        expect(resolverPanel(rol, new Set<Rol>([rol]))).toBe('/usa-la-app');
      }
      expect(resolverPanel('DESCONOCIDO' as Rol, new Set<Rol>())).toBe('/usa-la-app');
    });

    it('con rol primario sin panel cae al primer rol interno del conjunto', () => {
      expect(resolverPanel('CLIENTE', new Set<Rol>(['CLIENTE', 'CONTABLE']))).toBe('/admin/dashboard');
    });

    it('lleva a Recursos Humanos a la auditoría de técnicos', () => {
      expect(resolverPanel('RECURSOS_HUMANOS', new Set<Rol>(['RECURSOS_HUMANOS']))).toBe('/admin/validacion-tecnicos');
    });

    it('tolera la barra final en la preferencia guardada', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/admin/dashboard/');

      expect(resolverPanel('ADMINISTRADOR', new Set<Rol>(['ADMINISTRADOR']))).toBe('/admin/dashboard');
    });
  });

  describe('recordarPanel', () => {
    it('recuerda la torre de control', () => {
      recordarPanel('/admin/dashboard');

      expect(window.localStorage.getItem(CLAVE_PANEL_PREFERIDO)).toBe('/admin/dashboard');
    });

    it('no guarda rutas que no son paneles', () => {
      recordarPanel('/admin/disputas');

      expect(window.localStorage.getItem(CLAVE_PANEL_PREFERIDO)).toBeNull();
    });
  });

  describe('catálogo de paneles', () => {
    it('solo los roles internos tienen panel, según sus permisos', () => {
      expect(rutaDePanel('ADMINISTRADOR')).toBe('/admin/dashboard');
      expect(rutaDePanel('CONTABLE')).toBe('/admin/dashboard');
      expect(rutaDePanel('RECURSOS_HUMANOS')).toBe('/admin/validacion-tecnicos');
      expect(rutaDePanel('CLIENTE')).toBeNull();
      expect([...RUTAS_PANEL]).toEqual(['/admin/dashboard', '/admin/validacion-tecnicos']);
    });
  });
});
