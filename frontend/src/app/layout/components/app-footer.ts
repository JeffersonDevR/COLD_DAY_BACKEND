import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
      <div class="px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-2">
        <span>© 2026 COLD DAY S.A.S. Todos los derechos reservados. San José de Cúcuta, Colombia.</span>
        <span class="flex items-center gap-1">
          <i class="pi pi-map-marker"></i> Cúcuta, Norte de Santander
        </span>
      </div>
    </footer>
  `,
})
export class AppFooter {}
