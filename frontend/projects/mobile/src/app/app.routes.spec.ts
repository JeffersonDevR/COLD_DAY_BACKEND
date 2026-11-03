import {routes} from './app.routes';
import {MOBILE_TABS} from './mobile-mode';

describe('mobile routes', () => {
  it('redirects the root path to the login stub', () => {
    const root = routes.find((route) => route.path === '');

    expect(root?.redirectTo).toBe('login');
    expect(root?.pathMatch).toBe('full');
  });

  it('exposes /login and /tabs as lazy routes', () => {
    const paths = routes.map((route) => route.path);

    expect(paths).toContain('login');
    expect(paths).toContain('tabs');
    expect(routes.find((route) => route.path === 'login')?.loadComponent).toBeTypeOf('function');
  });

  it('routes every mobile tab under /tabs with its placeholder', () => {
    const tabsRoute = routes.find((route) => route.path === 'tabs');
    const children = tabsRoute?.children ?? [];

    expect(children.map((child) => child.path)).toEqual([
      '',
      'cliente',
      'tecnico',
      'proveedor',
    ]);
    expect(MOBILE_TABS.map((tab) => tab.path)).toEqual([
      '/tabs/cliente',
      '/tabs/tecnico',
      '/tabs/proveedor',
    ]);
    for (const tab of MOBILE_TABS) {
      const child = children.find((route) => route.path === tab.rol.toLowerCase());
      expect(child?.data?.['title']).toBe(tab.label);
    }
  });
});
