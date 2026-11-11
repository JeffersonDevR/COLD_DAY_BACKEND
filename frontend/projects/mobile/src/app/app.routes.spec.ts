import { routes } from './app.routes';
import { MODOS } from './modo/modo';

describe('mobile routes', () => {
  const paths = routes.map((route) => route.path);

  it('redirects the root path to login', () => {
    const root = routes.find((route) => route.path === '');

    expect(root?.redirectTo).toBe('login');
    expect(root?.pathMatch).toBe('full');
  });

  it('keeps login public and protects the shell', () => {
    const login = routes.find((route) => route.path === 'login');

    expect(login?.loadComponent).toBeTypeOf('function');
    expect(login?.canActivate).toBeUndefined();
    expect(routes.find((route) => route.path === 'solo-web')?.canActivate).toBeDefined();
  });

  it('keeps registration public, next to login', () => {
    const registro = routes.find((route) => route.path === 'registro');

    expect(registro?.loadComponent).toBeTypeOf('function');
    expect(registro?.canActivate).toBeUndefined();
    expect(paths.indexOf('registro')).toBe(paths.indexOf('login') + 1);
  });

  it('exposes one tab shell per mobile mode', () => {
    for (const modo of ['cliente', 'tecnico', 'proveedor'] as const) {
      const route = routes.find((item) => item.path === modo);

      expect(route?.loadComponent).toBeTypeOf('function');
      expect(route?.canActivate).toHaveLength(2);
      expect(route?.data?.['modo']).toBe(modo.toUpperCase());
    }
  });

  it('maps every tab id to a child route of its mode', () => {
    for (const modo of ['cliente', 'tecnico', 'proveedor'] as const) {
      const route = routes.find((item) => item.path === modo);
      const children = route?.children ?? [];
      const expected = MODOS[modo.toUpperCase() as 'CLIENTE' | 'TECNICO' | 'PROVEEDOR'].tabs.map(
        (tab) => tab.id,
      );

      // Los tabs van primero y en su orden; después pueden venir rutas extra
      // del modo (p. ej. `/cliente/solicitar`, que no es un tab).
      expect(children.slice(0, expected.length + 1).map((child) => child.path)).toEqual([
        '',
        ...expected,
      ]);
      expect(children[0].redirectTo).toBe(expected[0]);
      for (const child of children.slice(1, expected.length + 1)) {
        expect(child.loadComponent).toBeTypeOf('function');
      }
    }
  });

  it('abre la solicitud de servicio bajo el modo cliente, sin tab propio', () => {
    const cliente = routes.find((item) => item.path === 'cliente');
    const solicitar = cliente?.children?.find((child) => child.path === 'solicitar');

    expect(solicitar?.loadComponent).toBeTypeOf('function');
    expect(MODOS.CLIENTE.tabs.map((tab) => tab.id)).not.toContain('solicitar');
  });

  it('opens the OT follow-up screen under the client mode, without its own tab', () => {
    const cliente = routes.find((item) => item.path === 'cliente');
    const seguimiento = cliente?.children
      ?.find((child) => child.path === 'ot/:id')
      ?.children?.find((child) => child.path === '');

    expect(seguimiento?.loadComponent).toBeTypeOf('function');
    expect(MODOS.CLIENTE.tabs.map((tab) => tab.id)).not.toContain('ot');
  });

  it('opens the OT diagnosis screen nested under ot/:id, without its own tab', () => {
    const cliente = routes.find((item) => item.path === 'cliente');
    const ot = cliente?.children?.find((child) => child.path === 'ot/:id');

    // A7 hangs off the OT branch: ot/:id is componentless and its children
    // stack in the same outlet as the follow-up screen.
    expect(ot?.loadComponent).toBeUndefined();
    // A8 and A9 landed: both routes hang off the same branch.
    expect(ot?.children?.map((child) => child.path)).toEqual([
      '',
      'diagnostico',
      'pago',
      'calificar',
    ]);

    const diagnostico = ot?.children?.find((child) => child.path === 'diagnostico');
    expect(diagnostico?.loadComponent).toBeTypeOf('function');

    const pago = ot?.children?.find((child) => child.path === 'pago');
    expect(pago?.loadComponent).toBeTypeOf('function');

    const calificar = ot?.children?.find((child) => child.path === 'calificar');
    expect(calificar?.loadComponent).toBeTypeOf('function');

    // A9 is nested under ot/:id, not a direct child of the mode.
    const hijas = (cliente?.children ?? []).map((child) => child.path);
    expect(hijas).not.toContain('ot/:id/calificar');
    expect(hijas).toContain('ot/:id');
  });

  it('el panel del cliente tiene pantalla propia, no el placeholder compartido', () => {
    const cliente = routes.find((item) => item.path === 'cliente');
    const panel = cliente?.children?.find((child) => child.path === 'panel');
    // Cada leaf tiene su propia pantalla: nadie comparte el placeholder.
    const equipos = cliente?.children?.find((child) => child.path === 'equipos');

    expect(panel?.loadComponent).toBeTypeOf('function');
    expect(equipos?.loadComponent).toBeTypeOf('function');
    expect(panel?.loadComponent).not.toBe(equipos?.loadComponent);
  });

  it('leaves the mode home one segment below the mode prefix', () => {
    expect(MODOS.CLIENTE.home).toBe('/cliente/panel');
    expect(MODOS.TECNICO.home).toBe('/tecnico/radar');
    expect(MODOS.PROVEEDOR.home).toBe('/proveedor/insumos');
    expect(MODOS.CLIENTE.tabs.map((tab) => tab.label)).toEqual(['Panel', 'Equipos', 'Cuenta']);
    expect(MODOS.TECNICO.tabs.map((tab) => tab.label)).toEqual(['Radar', 'Mis OTs', 'Cuenta']);
    expect(MODOS.PROVEEDOR.tabs.map((tab) => tab.label)).toEqual([
      'Insumos',
      'Documentos',
      'Cuenta',
    ]);
  });

  it('liquidaciones no es tab del técnico, pero la ruta sigue existiendo', () => {
    // Decisión: la plata no ocupa un tab; se entra por la tarjeta del panel.
    expect(MODOS.TECNICO.tabs.map((tab) => tab.id)).not.toContain('liquidaciones');

    const tecnico = routes.find((route) => route.path === 'tecnico');
    const liquidaciones = tecnico?.children?.find((child) => child.path === 'liquidaciones');

    expect(liquidaciones?.loadComponent).toBeTypeOf('function');
  });

  it('keeps the canonical /cuenta route outside the tabs', () => {
    expect(paths).toContain('cuenta');
    expect(routes.find((route) => route.path === 'cuenta')?.loadComponent).toBeTypeOf('function');
  });

  it('sends unknown paths back to login', () => {
    expect(routes.at(-1)?.path).toBe('**');
    expect(routes.at(-1)?.redirectTo).toBe('login');
  });
});
