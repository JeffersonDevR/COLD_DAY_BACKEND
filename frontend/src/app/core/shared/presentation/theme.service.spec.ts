import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

vi.mock('@primeuix/themes', () => {
  const fluent: Record<string, () => unknown> = {};
  fluent['preset'] = () => fluent;
  fluent['surfacePalette'] = () => fluent;
  fluent['use'] = () => fluent;
  return {
    $t: () => fluent,
    updatePreset: () => undefined,
    updateSurfacePalette: () => undefined,
  };
});

describe('ThemeService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('arranca con los valores por defecto', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.preset()).toBe('Aura');
    expect(service.primary()).toBe('sky');
    expect(service.surface()).toBe('slate');
  });

  it('toggleTheme alterna y persiste', () => {
    const service = TestBed.inject(ThemeService);
    const antes = service.isDark();
    service.toggleTheme();
    expect(service.isDark()).toBe(!antes);
    expect(window.localStorage.getItem('coldday.theme')).toContain(`"dark":${!antes}`);
  });

  it('setTheme aplica la clase dark en el documento', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    service.setTheme(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setPrimary y setSurface actualizan y persisten', () => {
    const service = TestBed.inject(ThemeService);
    service.setPrimary('emerald');
    service.setSurface('zinc');
    expect(service.primary()).toBe('emerald');
    expect(service.surface()).toBe('zinc');
    const stored = JSON.parse(window.localStorage.getItem('coldday.theme') ?? '{}') as {
      primary?: string;
      surface?: string;
    };
    expect(stored.primary).toBe('emerald');
    expect(stored.surface).toBe('zinc');
  });

  it('setSurface ignora superficies desconocidas', () => {
    const service = TestBed.inject(ThemeService);
    service.setSurface('inexistente');
    expect(service.surface()).toBe('slate');
  });

  it('restaura la configuración persistida', () => {
    window.localStorage.setItem(
      'coldday.theme',
      JSON.stringify({ dark: true, preset: 'Lara', primary: 'blue', surface: 'zinc' }),
    );
    const service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(true);
    expect(service.preset()).toBe('Lara');
    expect(service.primary()).toBe('blue');
    expect(service.surface()).toBe('zinc');
  });

  it('primaryColors incluye noir y los colores disponibles', () => {
    const service = TestBed.inject(ThemeService);
    const colores = service.primaryColors();
    expect(colores[0].name).toBe('noir');
    expect(colores.length).toBe(17);
  });
});
