import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';
import { LayoutService } from '../service/layout.service';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { buildMenu } from '../app.menu';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Tooltip],
  template: `
    <!-- Contenido del menú reutilizado por el sidebar de escritorio y el drawer móvil -->
    <ng-template #menu let-collapsed="collapsed">
      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        @for (section of sections(); track section.label) {
          <div>
            @if (!collapsed) {
              <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {{ section.label }}
              </p>
            }
            <ul class="space-y-1">
              @for (item of section.items; track item.routerLink) {
                <li>
                  <a
                    [routerLink]="item.routerLink"
                    routerLinkActive="bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300"
                    (click)="onNavigate()"
                    class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                    [class.justify-center]="collapsed"
                    [pTooltip]="item.label"
                    tooltipPosition="right"
                    [tooltipDisabled]="!collapsed"
                  >
                    <i [class]="item.icon + ' text-base shrink-0'"></i>
                    @if (!collapsed) {
                      <span class="truncate">{{ item.label }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </ng-template>

    <!-- Sidebar de escritorio: estática (colapsable) u overlay (flotante) -->
    <aside
      class="hidden lg:flex flex-col fixed top-16 bottom-0 left-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200"
      [class.w-72]="isStatic() ? !layout.sidebarCollapsed() : true"
      [class.w-20]="isStatic() && layout.sidebarCollapsed()"
      [class.-translate-x-full]="!isStatic() && !layout.overlayMenuActive()"
      [class.z-50]="!isStatic()"
      [class.z-40]="isStatic()"
    >
      <ng-container
        *ngTemplateOutlet="menu; context: { collapsed: isStatic() ? layout.sidebarCollapsed() : false }"
      />
    </aside>

    <!-- Máscaras: móvil (drawer) y escritorio (overlay) -->
    @if (layout.mobileMenuOpen()) {
      <div
        class="lg:hidden fixed inset-0 top-16 z-40 bg-slate-950/50 backdrop-blur-sm"
        (click)="layout.closeOverlays()"
        aria-hidden="true"
      ></div>
    }
    @if (layout.overlayMenuActive()) {
      <div
        class="hidden lg:block fixed inset-0 top-16 z-40 bg-slate-950/50 backdrop-blur-sm"
        (click)="layout.closeOverlays()"
        aria-hidden="true"
      ></div>
    }

    <!-- Drawer móvil -->
    <aside
      class="lg:hidden fixed top-16 bottom-0 left-0 z-50 w-72 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-200"
      [class.-translate-x-full]="!layout.mobileMenuOpen()"
      [class.translate-x-0]="layout.mobileMenuOpen()"
    >
      <ng-container *ngTemplateOutlet="menu; context: { collapsed: false }" />
    </aside>
  `,
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
