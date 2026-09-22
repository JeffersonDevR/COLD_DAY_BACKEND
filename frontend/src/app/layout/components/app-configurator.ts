import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ThemeService, ThemePresetName } from '../../core/shared/presentation/theme.service';
import { LayoutService, MenuMode } from '../service/layout.service';

@Component({
  selector: 'app-configurator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectButton, ToggleSwitch],
  template: `
    <div class="flex flex-col gap-5 w-72 p-4">
      <!-- Color primario -->
      <div>
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Color primario</span>
        <div class="pt-2 flex gap-2 flex-wrap">
          @for (color of theme.primaryColors(); track color.name) {
            <button
              type="button"
              [title]="color.name"
              (click)="theme.setPrimary(color.name)"
              class="w-6 h-6 rounded-full shadow-sm ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-transform hover:scale-110"
              [class.ring-2]="theme.primary() === color.name"
              [class.ring-sky-500]="theme.primary() === color.name"
              [style.background-color]="color.name === 'noir' ? 'var(--p-text-color)' : color.palette['500']"
            ></button>
          }
        </div>
      </div>

      <!-- Superficie -->
      <div>
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Superficie</span>
        <div class="pt-2 flex gap-2 flex-wrap">
          @for (surface of theme.surfaces; track surface.name) {
            <button
              type="button"
              [title]="surface.name"
              (click)="theme.setSurface(surface.name)"
              class="w-6 h-6 rounded-full shadow-sm ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-transform hover:scale-110"
              [class.ring-2]="theme.surface() === surface.name"
              [class.ring-sky-500]="theme.surface() === surface.name"
              [style.background-color]="surface.palette['500']"
            ></button>
          }
        </div>
      </div>

      <!-- Preset -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preset</span>
        <p-selectbutton
          [options]="presetOptions"
          [ngModel]="theme.preset()"
          (ngModelChange)="onPresetChange($event)"
          [allowEmpty]="false"
          size="small"
        />
      </div>

      <!-- Layout (modo de menú) -->
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Layout</span>
        <p-selectbutton
          [options]="menuModeOptions"
          [ngModel]="layout.menuMode()"
          (ngModelChange)="layout.setMenuMode($event)"
          [allowEmpty]="false"
          size="small"
        />
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Barra lateral colapsada</span>
          <p-toggleswitch
            [ngModel]="layout.sidebarCollapsed()"
            (ngModelChange)="layout.setSidebarCollapsed($event)"
            [disabled]="layout.menuMode() === 'overlay'"
          />
        </div>
      </div>

      <!-- Modo oscuro -->
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Modo oscuro</span>
        <p-toggleswitch [ngModel]="theme.isDark()" (ngModelChange)="theme.setTheme($event)" />
      </div>
    </div>
  `,
})
export class AppConfigurator {
  readonly theme = inject(ThemeService);
  readonly layout = inject(LayoutService);

  readonly presetOptions = [
    { label: 'Aura', value: 'Aura' },
    { label: 'Lara', value: 'Lara' },
    { label: 'Nora', value: 'Nora' },
  ];

  readonly menuModeOptions: { label: string; value: MenuMode }[] = [
    { label: 'Estático', value: 'static' },
    { label: 'Overlay', value: 'overlay' },
  ];

  onPresetChange(value: ThemePresetName): void {
    this.theme.setPreset(value);
  }
}
