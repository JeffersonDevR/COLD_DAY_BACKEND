import { DEEP_LINKS, DeepLinkConfig, rutaDeDeepLink } from './deep-links';

const HABILITADO: DeepLinkConfig = {
  habilitado: true,
  hosts: ['coldday.co'],
  esquemas: ['coldday'],
};

describe('deep links (contrato listo, host por reemplazar)', () => {
  it('con la configuración real desactivada no navega a ninguna parte', () => {
    expect(DEEP_LINKS.habilitado).toBe(false);
    expect(rutaDeDeepLink('https://coldday.co/ot/abc')).toBeNull();
  });

  it('mapea el enlace web de una OT al seguimiento del cliente', () => {
    expect(rutaDeDeepLink('https://coldday.co/ot/6f1d', HABILITADO)).toBe('/cliente/ot/6f1d');
  });

  it('mapea el esquema propio de ejecución al panel del técnico', () => {
    expect(rutaDeDeepLink('coldday://tecnico/ejecucion/9a2b', HABILITADO)).toBe(
      '/tecnico/ejecucion/9a2b',
    );
  });

  it('mapea liquidaciones y panel', () => {
    expect(rutaDeDeepLink('coldday://tecnico/liquidaciones', HABILITADO)).toBe(
      '/tecnico/liquidaciones',
    );
    expect(rutaDeDeepLink('https://coldday.co/cliente/panel', HABILITADO)).toBe('/cliente/panel');
  });

  it('ignora un dominio ajeno: un enlace externo no puede abrir la app en una ruta', () => {
    expect(rutaDeDeepLink('https://evil.example/ot/abc', HABILITADO)).toBeNull();
    expect(rutaDeDeepLink('https://coldday.co.evil.example/ot/abc', HABILITADO)).toBeNull();
  });

  it('ignora rutas desconocidas y URLs inválidas', () => {
    expect(rutaDeDeepLink('https://coldday.co/desconocido', HABILITADO)).toBeNull();
    expect(rutaDeDeepLink('https://coldday.co/ot/', HABILITADO)).toBeNull();
    expect(rutaDeDeepLink('no-es-una-url', HABILITADO)).toBeNull();
  });

  it('rechaza un id que no tiene forma de UUID', () => {
    expect(rutaDeDeepLink('https://coldday.co/ot/a%2Fb', HABILITADO)).toBeNull();
    expect(rutaDeDeepLink('https://coldday.co/ot/../panel', HABILITADO)).toBeNull();
  });

  it('acepta un UUID real', () => {
    expect(rutaDeDeepLink('https://coldday.co/ot/6f1d8a90-3b9c-4e2a-9d7e-123456789abc', HABILITADO))
      .toBe('/cliente/ot/6f1d8a90-3b9c-4e2a-9d7e-123456789abc');
  });
});
