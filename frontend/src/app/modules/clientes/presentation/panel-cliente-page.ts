import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { EmptyState } from '../../../core/shared/presentation/components/empty-state';

@Component({
  selector: 'app-panel-cliente-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatIconModule, EstadoBadge, EmptyState],
  template: `
    <div class="space-y-6">
      <!-- Banner de Bienvenida -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 to-cyan-500 p-6 sm:p-8 text-white shadow-lg">
        <div class="relative z-10 max-w-2xl">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs mb-2">
            <mat-icon class="text-xs">verified_user</mat-icon> Panel de Autogestión Cliente
          </span>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hola, {{ authService.currentUser()?.nombre || 'Usuario' }}
          </h1>
          <p class="text-xs sm:text-sm text-sky-100 mt-1 leading-relaxed">
            Solicita técnicos certificados en Cúcuta con seguimiento geolocalizado en vivo y acta formal de garantía.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <a
              routerLink="/cliente/solicitar"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold text-xs sm:text-sm shadow-md transition-colors"
            >
              <mat-icon class="text-sm">add_circle</mat-icon>
              Solicitar Nuevo Servicio
            </a>
            <a
              routerLink="/cliente/historial"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700/60 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm transition-colors"
            >
              <mat-icon class="text-sm">history</mat-icon>
              Historial de Equipos
            </a>
          </div>
        </div>
      </div>

      <!-- Métricas del Cliente -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <mat-icon>pending_actions</mat-icon>
          </div>
          <div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100">{{ serviciosActivos().length }}</div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Servicios en Proceso</div>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <mat-icon>check_circle</mat-icon>
          </div>
          <div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100">{{ serviciosFinalizados().length }}</div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Servicios Concluidos</div>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <mat-icon>shield</mat-icon>
          </div>
          <div>
            <div class="text-2xl font-black text-slate-900 dark:text-slate-100">90 días</div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Garantía Certificada</div>
          </div>
        </div>
      </div>

      <!-- Servicios Activos en Seguimiento -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Mis Servicios Técnicos Activos</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Trazabilidad en tiempo real y asignación perimetral</p>
          </div>
          <a
            routerLink="/cliente/solicitar"
            class="text-xs font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 inline-flex items-center gap-1"
          >
            <mat-icon class="text-sm">add</mat-icon>
            Nueva OT
          </a>
        </div>

        @if (serviciosActivos().length === 0) {
          <app-empty-state
            icon="task_alt"
            title="No tienes servicios en curso"
            description="Todos tus requerimientos técnicos están al día. Si necesitas asistencia para tus aires o electrodomésticos, solicita uno nuevo."
            actionLabel="Solicitar Asistencia"
            actionIcon="add_circle"
            (actionClicked)="irASolicitar()"
          />
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (ot of serviciosActivos(); track ot.id) {
              <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-sky-400 transition-all flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{{ ot.id }}</span>
                    <app-estado-badge [estado]="ot.estado" />
                  </div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {{ ot.categoriaServicio.replace('_', ' ') }}
                  </h3>
                  <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {{ ot.descripcionFalla }}
                  </p>

                  <div class="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div class="flex items-center gap-1">
                      <mat-icon class="text-xs">location_on</mat-icon>
                      <span class="truncate max-w-[150px]">{{ ot.barrio || ot.direccion }}</span>
                    </div>
                    <span>{{ ot.fechaCreacion | date:'shortTime' }}</span>
                  </div>
                </div>

                <div class="mt-4 pt-3 flex items-center justify-end gap-2">
                  @if (ot.estado === 'EN_DIAGNOSTICO' && ot.diagnostico) {
                    <a
                      [routerLink]="['/cliente/ot', ot.id, 'diagnostico']"
                      class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <mat-icon class="text-xs">rate_review</mat-icon>
                      Revisar Presupuesto
                    </a>
                  }
                  <a
                    [routerLink]="['/cliente/ot', ot.id]"
                    class="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <mat-icon class="text-xs">visibility</mat-icon>
                    Seguimiento en Vivo
                  </a>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class PanelClientePage {
  readonly mockDb = inject(MockDbService);
  readonly authService = inject(AuthService);

  readonly serviciosCliente = computed(() => {
    const currentId = String(this.authService.currentUser()?.id || 3);
    return this.mockDb.ordenesTrabajo().filter(o => o.clienteId === currentId || !o.clienteId);
  });

  readonly serviciosActivos = computed(() => {
    return this.serviciosCliente().filter(o =>
      !['FINALIZADA', 'CANCELADA'].includes(o.estado)
    );
  });

  readonly serviciosFinalizados = computed(() => {
    return this.serviciosCliente().filter(o => o.estado === 'FINALIZADA');
  });

  irASolicitar(): void {
    // routerLink handles this
  }
}
