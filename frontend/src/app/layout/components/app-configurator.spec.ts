import { TestBed } from '@angular/core/testing';
import { AppConfigurator } from './app-configurator';
import { ThemeService } from '../../core/shared/presentation/theme.service';
import { LayoutService } from '../service/layout.service';

function themeMock() {
  return {
    primaryColors: () => [
      { name: 'noir', palette: {} },
      { name: 'sky', palette: { 500: '#0ea5e9' } },
    ],
    primary: () => 'sky',
    surfaces: [{ name: 'slate', palette: { 500: '#64748b' } }],
    surface: () => 'slate',
    preset: () => 'Aura',
    isDark: () => false,
    setPrimary: vi.fn(),
    setSurface: vi.fn(),
    setPreset: vi.fn(),
    setTheme: vi.fn(),
  };
}

function layoutMock() {
  return {
    menuMode: () => 'static',
    sidebarCollapsed: () => false,
    setMenuMode: vi.fn(),
    setSidebarCollapsed: vi.fn(),
  };
}

describe('AppConfigurator', () => {
  async function create() {
    const theme = themeMock();
    const layout = layoutMock();
    await TestBed.configureTestingModule({
      imports: [AppConfigurator],
      providers: [
        { provide: ThemeService, useValue: theme },
        { provide: LayoutService, useValue: layout },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppConfigurator);
    fixture.detectChanges();
    return { fixture, theme, layout };
  }

  it('renderiza los colores, superficies y opciones', async () => {
    const { fixture } = await create();
    const botones = fixture.nativeElement.querySelectorAll('button[title]') as NodeListOf<HTMLButtonElement>;
    expect(botones.length).toBe(3);
  });

  it('cambia el color primario al pulsar un círculo', async () => {
    const { fixture, theme } = await create();
    const botones = fixture.nativeElement.querySelectorAll('button[title]') as NodeListOf<HTMLButtonElement>;
    botones[1].click();
    expect(theme.setPrimary).toHaveBeenCalledWith('sky');
  });

  it('delega el cambio de preset', async () => {
    const { fixture, theme } = await create();
    fixture.componentInstance.onPresetChange('Lara');
    expect(theme.setPreset).toHaveBeenCalledWith('Lara');
  });
});
