import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { $t, updatePreset, updateSurfacePalette } from '@primeuix/themes';
import type { Preset } from '@primeuix/themes/types';
import Aura from '@primeuix/themes/aura';

export type ThemePresetName = 'Aura' | 'Lara' | 'Nora';

export interface ColorPalette {
  name: string;
  palette: Record<string, string>;
}

export interface ThemeConfig {
  dark: boolean;
  preset: ThemePresetName;
  primary: string;
  surface: string;
}

/** Carga diferida de presets: solo se empaqueta el seleccionado (Aura va en el bundle inicial). */
async function loadPreset(name: ThemePresetName): Promise<Preset> {
  switch (name) {
    case 'Lara':
      return (await import('@primeuix/themes/lara')).default;
    case 'Nora':
      return (await import('@primeuix/themes/nora')).default;
    default:
      return Aura;
  }
}

const STORAGE_KEY = 'coldday.theme';

/** Paletas de superficie disponibles (equivalen a las de Sakai). */
export const SURFACES: ColorPalette[] = [
  {
    name: 'slate',
    palette: {
      0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
      400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b',
      900: '#0f172a', 950: '#020617',
    },
  },
  {
    name: 'gray',
    palette: {
      0: '#ffffff', 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
      400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937',
      900: '#111827', 950: '#030712',
    },
  },
  {
    name: 'zinc',
    palette: {
      0: '#ffffff', 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
      400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a',
      900: '#18181b', 950: '#09090b',
    },
  },
  {
    name: 'neutral',
    palette: {
      0: '#ffffff', 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4',
      400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626',
      900: '#171717', 950: '#0a0a0a',
    },
  },
  {
    name: 'stone',
    palette: {
      0: '#ffffff', 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
      400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524',
      900: '#1c1917', 950: '#0c0a09',
    },
  },
  {
    name: 'soho',
    palette: {
      0: '#ffffff', 50: '#ececec', 100: '#dedfdf', 200: '#c4c4c6', 300: '#adaeb0',
      400: '#97979b', 500: '#7f8084', 600: '#6a6b70', 700: '#55565b', 800: '#3f4046',
      900: '#2c2c34', 950: '#16161d',
    },
  },
  {
    name: 'viva',
    palette: {
      0: '#ffffff', 50: '#f3f3f3', 100: '#e7e7e8', 200: '#cfd0d0', 300: '#b7b8b9',
      400: '#9fa1a1', 500: '#87898a', 600: '#6e7173', 700: '#565a5b', 800: '#3e4244',
      900: '#262b2c', 950: '#0e1315',
    },
  },
  {
    name: 'ocean',
    palette: {
      0: '#ffffff', 50: '#fbfcfc', 100: '#f7f9f8', 200: '#eff3f2', 300: '#dadedd',
      400: '#b1b7b6', 500: '#828787', 600: '#5f7274', 700: '#415b61', 800: '#29444e',
      900: '#183240', 950: '#0c1920',
    },
  },
];

const PRIMARY_COLORS = [
  'emerald', 'green', 'lime', 'orange', 'amber', 'yellow', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

/**
 * Gestiona el tema de la app: modo claro/oscuro y personalización de PrimeNG
 * (preset, color primario y superficie), con persistencia en localStorage.
 * Reproduce el comportamiento del configurador de Sakai.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _isDark = signal(false);
  private readonly _preset = signal<ThemePresetName>('Aura');
  private readonly _primary = signal('sky');
  private readonly _surface = signal('slate');
  private readonly _presetObject = signal<Preset>(Aura);

  readonly isDark = this._isDark.asReadonly();
  readonly preset = this._preset.asReadonly();
  readonly primary = this._primary.asReadonly();
  readonly surface = this._surface.asReadonly();

  /** Colores primarios disponibles según el preset activo. */
  readonly primaryColors = computed<ColorPalette[]>(() => {
    const primitive = (this._presetObject() as { primitive?: Record<string, Record<string, string>> }).primitive ?? {};
    const palettes: ColorPalette[] = [{ name: 'noir', palette: {} }];
    PRIMARY_COLORS.forEach((name) => {
      palettes.push({ name, palette: primitive[name] ?? {} });
    });
    return palettes;
  });

  readonly surfaces = SURFACES;

  constructor() {
    if (this.isBrowser) {
      this.restore();
    }
  }

  private restore(): void {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

    let config: ThemeConfig = { dark: prefersDark, preset: 'Aura', primary: 'sky', surface: 'slate' };

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
        config = { ...config, ...parsed };
      } catch {
        // Compatibilidad con el formato anterior ('dark' | 'light').
        config.dark = raw === 'dark';
      }
    }

    this._isDark.set(config.dark);
    this._preset.set(config.preset);
    this._primary.set(config.primary);
    this._surface.set(config.surface);

    this.applyDarkClass(config.dark);
    this.applySurfaceVars(config.surface);
    void this.applyPreset(config.preset);
  }

  toggleTheme(): void {
    this.setTheme(!this._isDark());
  }

  setTheme(isDark: boolean): void {
    this._isDark.set(isDark);
    this.applyDarkClass(isDark);
    this.persist();
  }

  setPrimary(name: string): void {
    this._primary.set(name);
    updatePreset(this.getPresetExt(name));
    this.persist();
  }

  setSurface(name: string): void {
    const surface = this.surfaces.find((s) => s.name === name);
    if (!surface) return;
    this._surface.set(name);
    updateSurfacePalette(surface.palette);
    this.applySurfaceVars(name);
    this.persist();
  }

  setPreset(name: ThemePresetName): void {
    this._preset.set(name);
    void this.applyPreset(name);
    this.persist();
  }

  private async applyPreset(name: ThemePresetName): Promise<void> {
    const preset = await loadPreset(name);
    this._presetObject.set(preset);
    const surfacePalette = this.surfaces.find((s) => s.name === this._surface())?.palette;
    $t()
      .preset(preset)
      .preset(this.getPresetExt(this._primary()))
      .surfacePalette(surfacePalette)
      .use({ useDefaultOptions: true });
  }

  private applyDarkClass(isDark: boolean): void {
    if (!this.isBrowser) return;
    document.documentElement.classList.toggle('dark', isDark);
  }

  /**
   * Enlaza la paleta de superficie elegida a las utilidades Tailwind `slate-*`
   * (variables `--color-slate-*`), para que el tema repinte toda la UI.
   */
  private applySurfaceVars(name: string): void {
    if (!this.isBrowser) return;
    const palette = this.surfaces.find((s) => s.name === name)?.palette;
    if (!palette) return;
    const root = document.documentElement;
    ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'].forEach((shade) => {
      const value = palette[shade];
      if (value) root.style.setProperty(`--color-slate-${shade}`, value);
    });
  }

  private persist(): void {
    if (!this.isBrowser) return;
    const config: ThemeConfig = {
      dark: this._isDark(),
      preset: this._preset(),
      primary: this._primary(),
      surface: this._surface(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  /** Extensión de preset que aplica el color primario seleccionado (lógica de Sakai). */
  private getPresetExt(primaryName: string): Preset {
    const color = this.primaryColors().find((c) => c.name === primaryName) ?? { name: primaryName, palette: {} };
    const preset = this._preset();

    if (color.name === 'noir') {
      return {
        semantic: {
          primary: {
            50: '{surface.50}', 100: '{surface.100}', 200: '{surface.200}', 300: '{surface.300}',
            400: '{surface.400}', 500: '{surface.500}', 600: '{surface.600}', 700: '{surface.700}',
            800: '{surface.800}', 900: '{surface.900}', 950: '{surface.950}',
          },
          colorScheme: {
            light: {
              primary: { color: '{primary.950}', contrastColor: '#ffffff', hoverColor: '{primary.800}', activeColor: '{primary.700}' },
              highlight: { background: '{primary.950}', focusBackground: '{primary.700}', color: '#ffffff', focusColor: '#ffffff' },
            },
            dark: {
              primary: { color: '{primary.50}', contrastColor: '{primary.950}', hoverColor: '{primary.200}', activeColor: '{primary.300}' },
              highlight: { background: '{primary.50}', focusBackground: '{primary.300}', color: '{primary.950}', focusColor: '{primary.950}' },
            },
          },
        },
      };
    }

    if (preset === 'Nora') {
      return {
        semantic: {
          primary: color.palette,
          colorScheme: {
            light: {
              primary: { color: '{primary.600}', contrastColor: '#ffffff', hoverColor: '{primary.700}', activeColor: '{primary.800}' },
              highlight: { background: '{primary.600}', focusBackground: '{primary.700}', color: '#ffffff', focusColor: '#ffffff' },
            },
            dark: {
              primary: { color: '{primary.500}', contrastColor: '{surface.900}', hoverColor: '{primary.400}', activeColor: '{primary.300}' },
              highlight: { background: '{primary.500}', focusBackground: '{primary.400}', color: '{surface.900}', focusColor: '{surface.900}' },
            },
          },
        },
      };
    }

    return {
      semantic: {
        primary: color.palette,
        colorScheme: {
          light: {
            primary: { color: '{primary.500}', contrastColor: '#ffffff', hoverColor: '{primary.600}', activeColor: '{primary.700}' },
            highlight: { background: '{primary.50}', focusBackground: '{primary.100}', color: '{primary.700}', focusColor: '{primary.800}' },
          },
          dark: {
            primary: { color: '{primary.400}', contrastColor: '{surface.900}', hoverColor: '{primary.300}', activeColor: '{primary.200}' },
            highlight: {
              background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
              focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
              color: 'rgba(255,255,255,.87)',
              focusColor: 'rgba(255,255,255,.87)',
            },
          },
        },
      },
    };
  }
}
