import { Rol } from '../models/common.models';
import {
  CLAVE_PANEL_PREFERIDO,
  recordarPanel,
  resolverPanel,
  RUTAS_PANEL,
  rutaDePanel,
} from './panel-resolver';

const CLIENTE_Y_TECNICO: ReadonlySet<Rol> = new Set<Rol>(['CLIENTE', 'TECNICO']);

describe('panel-resolver', () => {
  beforeEach(() => window.localStorage.clear());

  describe('resolverPanel', () => {
    it('usa la preferencia guardada cuando los roles actuales la permiten', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/tecnico/panel');

      expect(resolverPanel('CLIENTE', CLIENTE_Y_TECNICO)).toBe('/tecnico/panel');
    });

    it('ignora una preferencia que los roles actuales ya no permiten', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/admin/dashboard');

      expect(resolverPanel('CLIENTE', CLIENTE_Y_TECNICO)).toBe('/cliente/panel');
    });

    it('sin preferencia usa el panel del rol primario', () => {
      expect(resolverPanel('TECNICO', CLIENTE_Y_TECNICO)).toBe('/tecnico/panel');
    });

    it('con rol primario sin panel cae al primer rol enrutable del conjunto', () => {
      const roles = new Set<Rol>(['DESCONOCIDO' as Rol, 'TECNICO']);

      expect(resolverPanel('DESCONOCIDO' as Rol, roles)).toBe('/tecnico/panel');
    });

    it('sin ningún rol enrutable vuelve a la raíz', () => {
      expect(resolverPanel('DESCONOCIDO' as Rol, new Set<Rol>())).toBe('/');
    });

    it('una preferencia desconocida o corrupta no rompe la resolución', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/ruta-que-no-existe');

      expect(resolverPanel('TECNICO', new Set<Rol>(['TECNICO']))).toBe('/tecnico/panel');
    });

    it('tolera la barra final en la preferencia guardada', () => {
      window.localStorage.setItem(CLAVE_PANEL_PREFERIDO, '/tecnico/panel/');

      expect(resolverPanel('CLIENTE', CLIENTE_Y_TECNICO)).toBe('/tecnico/panel');
    });
  });

  describe('recordarPanel', () => {
    it('recuerda el último panel visitado y el resolutor lo devuelve para un usuario dual-role', () => {
      recordarPanel('/tecnico/panel');
      expect(window.localStorage.getItem(CLAVE_PANEL_PREFERIDO)).toBe('/tecnico/panel');
      expect(resolverPanel('CLIENTE', CLIENTE_Y_TECNICO)).toBe('/tecnico/panel');

      // El último visita gana: el otro panel también está permitido.
      recordarPanel('/cliente/panel');
      expect(resolverPanel('CLIENTE', CLIENTE_Y_TECNICO)).toBe('/cliente/panel');
    });

    it('no guarda rutas que no son paneles', () => {
      recordarPanel('/cliente/solicitar');

      expect(window.localStorage.getItem(CLAVE_PANEL_PREFERIDO)).toBeNull();
    });
  });

  describe('catálogo de paneles', () => {
    it('los dos roles administrativos comparten la torre de control', () => {
      expect(rutaDePanel('ADMINISTRADOR')).toBe('/admin/dashboard');
      expect(rutaDePanel('CONTABLE')).toBe('/admin/dashboard');
    });

    it('RUTAS_PANEL contiene exactamente las rutas enrutable-evaluadas', () => {
      expect([...RUTAS_PANEL].sort()).toEqual([
        '/admin/dashboard',
        '/cliente/panel',
        '/proveedor/panel',
        '/tecnico/panel',
      ]);
    });
  });
});
