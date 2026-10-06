import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';
import { LayoutService } from '../../core/service/layout.service';
import { AuthService } from '../../core/service/auth.service';
import { buildMenu } from '../app.menu';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Tooltip],
  templateUrl: './app-sidebar.html',
})
export class AppSidebar {
  readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  readonly sections = computed(() => buildMenu(this.auth.userRole()));
  readonly isStatic = computed(() => this.layout.menuMode() === 'static');

  onNavigate(): void {
    this.layout.closeOverlays();
  }
}
