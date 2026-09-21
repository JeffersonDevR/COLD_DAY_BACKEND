import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { EstadoBadge } from '../../../core/shared/presentation/components/estado-badge';
import { EmptyState } from '../../../core/shared/presentation/components/empty-state';
import { EstadoOperativo } from '../../../core/shared/domain/models/common.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-panel-tecnico-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, EstadoBadge, EmptyState],
  template: `
    <div class="space-y-6 max-w-6xl mx-auto">
      <!-- BLOQUEO POR LIQUIDACIÓN PENDIENTE -->
      @if (tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
        <div class="p-6 rounded-3xl bg-rose-500 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 animate-pulse">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-2xl">
              <mat-icon class="text-3xl">lock</mat-icon>
            </div>
            <div>
              <h2 class="text-lg font-black tracking-tight">CUENTA BLOQUEADA POR LIQUIDACIÓN PENDIENTE</h2>
              <p class="text-xs text-rose-100 max-w-xl mt-1 leading-relaxed">
                Tienes comisiones del {{ comisionPorcentaje }}% retenidas en efectivo sin legalizar ante COLD DAY S.A.S. No podrás recibir ni aceptar nuevas solicitudes hasta subir el comprobante de consignación.
              </p>
            </div>
          </div>

          <a
            routerLink="/tecnico/liquidaciones"
            class="px-5 py-3 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
          >
            <mat-icon class="text-sm">receipt_long</mat-icon>
            Legalizar Consignación Ahora
          </a>
        </div>
      }

      <!-- Header y Switch Operativo -->
      <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-xl">
            {{ tecnico()?.nombreCompleto?.charAt(0) || 'T' }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {{ tecnico()?.nombreCompleto || 'Técnico Especialista' }}
              </h1>
              <span class="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                <mat-icon class="text-xs" style="font-size:14px; width:14px; height:14px;">star</mat-icon>
                {{ tecnico()?.reputacion || 4.9 }}
              </span>
            </div>
            <p class="text-xs text-slate-500">
              Cédula: {{ tecnico()?.cedula }} • Matrícula SENA / CONTE: {{ tecnico()?.certificaciones?.join(', ') || 'Vigente' }}
            </p>
          </div>
        </div>

        <!-- Switch Estado Operativo -->
        <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">Estado:</span>
          <button
            type="button"
            (click)="cambiarEstadoOperativo('DISPONIBLE')"
            [disabled]="tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION'"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            [class.bg-emerald-600]="tecnico()?.estadoOperativo === 'DISPONIBLE'"
            [class.text-white]="tecnico()?.estadoOperativo === 'DISPONIBLE'"
            [class.text-slate-600]="tecnico()?.estadoOperativo !== 'DISPONIBLE'"
            [class.dark:text-slate-400]="tecnico()?.estadoOperativo !== 'DISPONIBLE'"
          >
            DISPONIBLE
          </button>
          <button
            type="button"
            (click)="cambiarEstadoOperativo('OCUPADO')"
            [disabled]="tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION'"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            [class.bg-sky-600]="tecnico()?.estadoOperativo === 'OCUPADO'"
            [class.text-white]="tecnico()?.estadoOperativo === 'OCUPADO'"
            [class.text-slate-600]="tecnico()?.estadoOperativo !== 'OCUPADO'"
            [class.dark:text-slate-400]="tecnico()?.estadoOperativo !== 'OCUPADO'"
          >
            OCUPADO
          </button>
          <button
            type="button"
            (click)="cambiarEstadoOperativo('FUERA_DE_SERVICIO')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            [class.bg-slate-600]="tecnico()?.estadoOperativo === 'FUERA_DE_SERVICIO'"
            [class.text-white]="tecnico()?.estadoOperativo === 'FUERA_DE_SERVICIO'"
            [class.text-slate-600]="tecnico()?.estadoOperativo !== 'FUERA_DE_SERVICIO'"
            [class.dark:text-slate-400]="tecnico()?.estadoOperativo !== 'FUERA_DE_SERVICIO'"
          >
            OFFLINE
          </button>
        </div>
      </div>

      <!-- KPIs del Técnico -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div class="text-xs font-semibold text-slate-500">Servicios Concluidos</div>
          <div class="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {{ tecnico()?.serviciosCompletados || 0 }}
          </div>
          <span class="text-[11px] text-emerald-600 font-semibold">Tasa de éxito 98%</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div class="text-xs font-semibold text-slate-500">Reputación Promedio</div>
          <div class="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1">
            <mat-icon>star</mat-icon> {{ tecnico()?.reputacion || 4.9 }}
          </div>
          <span class="text-[11px] text-slate-400">12 reseñas verificadas</span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div class="text-xs font-semibold text-slate-500">Comisión COLD DAY ({{ comisionPorcentaje }}%)</div>
          <div class="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            $ {{ (tecnico()?.deudaComisionCop || 0).toLocaleString('es-CO') }}
          </div>
          <span class="text-[11px] font-semibold" [class.text-rose-500]="(tecnico()?.deudaComisionCop || 0) > 0" [class.text-emerald-500]="(tecnico()?.deudaComisionCop || 0) === 0">
            {{ (tecnico()?.deudaComisionCop || 0) > 0 ? 'Pendiente legalizar' : 'Al día' }}
          </span>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div class="text-xs font-semibold text-slate-500">Documentación</div>
          <div class="text-base font-black text-emerald-600 mt-2 flex items-center gap-1">
            <mat-icon class="text-sm">verified</mat-icon>
            {{ tecnico()?.estadoValidacion || 'APROBADO' }}
          </div>
          <a routerLink="/tecnico/documentos" class="text-[11px] text-sky-600 hover:underline">Ver vigencias</a>
        </div>
      </div>

      <!-- Accesos Rápidos -->
      <div class="flex flex-wrap gap-3">
        <a
          routerLink="/tecnico/ofertas"
          class="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-2"
        >
          <mat-icon class="text-sm">radar</mat-icon>
          Ver Radar de Solicitudes Entrantes
        </a>

        <a
          routerLink="/tecnico/liquidaciones"
          class="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-bold text-xs sm:text-sm shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <mat-icon class="text-sm">account_balance_wallet</mat-icon>
          Liquidaciones y Consignaciones
        </a>

        <a
          routerLink="/tecnico/documentos"
          class="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-bold text-xs sm:text-sm shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <mat-icon class="text-sm">folder_shared</mat-icon>
          Auditoría de Documentos
        </a>
      </div>

      <!-- Mis Servicios en Curso Asignados -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Mis Servicios Asignados en Curso</h2>
            <p class="text-xs text-slate-500">Gestiona desplazamientos, diagnósticos y actas de cierre</p>
          </div>
        </div>

        @if (misOtsEnCurso().length === 0) {
          <app-empty-state
            icon="radar"
            title="No tienes servicios asignados en este momento"
            description="Revisa el radar de ofertas en Cúcuta para aceptar nuevas órdenes de trabajo en tu perímetro."
            actionLabel="Ir al Radar de Ofertas"
            actionIcon="radar"
            (actionClicked)="irAOfertas()"
          />
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (ot of misOtsEnCurso(); track ot.id) {
              <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-slate-500">{{ ot.id }}</span>
                  <app-estado-badge [estado]="ot.estado" />
                </div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {{ ot.categoriaServicio.replace('_', ' ') }}
                </h3>
                <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {{ ot.descripcionFalla }}
                </p>

                <div class="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div class="flex items-center gap-1">
                    <mat-icon class="text-xs">person</mat-icon>
                    <span>Cliente: {{ ot.clienteNombre }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <mat-icon class="text-xs">location_on</mat-icon>
                    <span>{{ ot.direccion }} ({{ ot.barrio }})</span>
                  </div>
                </div>

                <div class="pt-2 flex justify-end">
                  <a
                    [routerLink]="['/tecnico/ejecucion', ot.id]"
                    class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <mat-icon class="text-xs">build</mat-icon>
                    Ejecutar Servicio
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
export class PanelTecnicoPage {
  readonly mockDb = inject(MockDbService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  /** Porcentaje de comisión de la plataforma (15%), alineado al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly tecnico = computed(() => {
    const user = this.authService.currentUser();
    const tecId = String(user?.id || 1);
    return this.mockDb.tecnicos().find(t => t.id === tecId || t.correo === user?.correo);
  });

  readonly misOtsEnCurso = computed(() => {
    const t = this.tecnico();
    if (!t) return [];
    return this.mockDb.ordenesTrabajo().filter(o =>
      o.tecnicoId === t.id && !['FINALIZADA', 'CANCELADA'].includes(o.estado)
    );
  });

  cambiarEstadoOperativo(nuevo: EstadoOperativo): void {
    const t = this.tecnico();
    if (!t) return;
    this.tecnicosApi.actualizarEstadoOperativo(t.id, nuevo).subscribe({
      next: () => {
        this.toast.info('Estado Actualizado', `Ahora estás ${nuevo}`);
      }
    });
  }

  irAOfertas(): void {
    void this.router.navigate(['/tecnico/ofertas']);
  }
}
