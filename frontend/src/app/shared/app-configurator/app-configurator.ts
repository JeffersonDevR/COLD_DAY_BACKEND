import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ThemeService, ThemePresetName } from '../../core/service/theme.service';
import { LayoutService, MenuMode } from '../../core/service/layout.service';

@Component({
  selector: 'app-configurator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectButton, ToggleSwitch],
  templateUrl: './app-configurator.html',
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
