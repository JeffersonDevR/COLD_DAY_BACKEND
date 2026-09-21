import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { AdminApi } from '../infrastructure/admin-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { DisputaResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-disputas-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-6xl mx-auto">
      <div>
        <a routerLink="/admin/dashboard" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
          <mat-icon class="text-xs">arrow_back</mat-icon> Volver a la Torre de Control
        </a>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Mesa de Mediación y Disputas Técnicas
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Conciliación administrativa entre cliente y técnico por discrepancias en repuestos, tarifas o tiempos
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (disp of disputas(); track disp.id) {
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span class="font-mono text-xs font-bold text-slate-500">{{ disp.id }} (OT: {{ disp.otId }})</span>
              <span
                class="px-2.5 py-1 rounded-full text-[11px] font-bold"
                [class.bg-rose-100]="disp.estado === 'ABIERTA'"
                [class.text-rose-800]="disp.estado === 'ABIERTA'"
                [class.bg-emerald-100]="disp.estado === 'RESUELTA_CON_ACUERDO'"
                [class.text-emerald-800]="disp.estado === 'RESUELTA_CON_ACUERDO'"
              >
                {{ disp.estado }}
              </span>
            </div>

            <!-- Intervinientes -->
            <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
              <div>
                <span class="text-slate-400 block">Cliente:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ disp.clienteNombre }}</span>
              </div>
              <div>
                <span class="text-slate-400 block">Técnico:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ disp.tecnicoNombre }}</span>
              </div>
            </div>

            <!-- Motivo de la Disputa -->
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Motivo Reportado:</span>
              <p class="text-xs text-slate-700 dark:text-slate-300 bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200/60 dark:border-rose-800/60 leading-relaxed">
                {{ disp.motivo }}
              </p>
            </div>

            @if (disp.estado === 'RESUELTA_CON_ACUERDO') {
              <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <span class="font-bold block">Dictamen de Resolución:</span>
                <p>{{ disp.resolucion }}</p>
                <span class="text-[10px] text-slate-400 block">Mediador: {{ disp.adminResponsable }}</span>
              </div>
            } @else {
              <!-- Acciones de Mediador -->
              <div class="pt-2 flex justify-end">
                <button
                  type="button"
                  (click)="abrirResolucion(disp)"
                  class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5"
                >
                  <mat-icon class="text-sm">gavel</mat-icon>
                  Emitir Fallo de Mediación
                </button>
              </div>
            }
          </div>
        }
      </div>

      <!-- Modal de Mediación -->
      @if (disputaSeleccionada(); as d) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 class="text-base font-bold text-purple-600 flex items-center gap-2">
              <mat-icon>gavel</mat-icon> Mediación Oficial: Caso {{ d.id }}
            </h3>
            <p class="text-xs text-slate-500">
              Escucha a ambas partes y emite una solución técnica de común acuerdo o cierre judicial.
            </p>

            <div>
              <label for="dictamen-legal" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dictamen y Acuerdo Legal *</label>
              <textarea
                id="dictamen-legal"
                rows="3"
                [formControl]="resolucionCtrl"
                placeholder="Ej. Se acuerda aplicar descuento de 10% en mano de obra y reanudar la reparación con supervisión de COLD DAY..."
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500"
              ></textarea>
            </div>

            <div class="flex items-center justify-between pt-2">
              <button
                type="button"
                (click)="disputaSeleccionada.set(null)"
                class="px-3.5 py-1.5 text-xs text-slate-500"
              >
                Cancelar
              </button>

              <div class="flex gap-2">
                <button
                  type="button"
                  [disabled]="resolucionCtrl.invalid"
                  (click)="resolver(false)"
                  class="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
                >
                  Cerrar Sin Acuerdo (Cancelar OT)
                </button>

                <button
                  type="button"
                  [disabled]="resolucionCtrl.invalid"
                  (click)="resolver(true)"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
                >
                  Cerrar Con Acuerdo
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DisputasAdminPage {
  private readonly mockDb = inject(MockDbService);
  private readonly adminApi = inject(AdminApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly disputas = computed(() => this.mockDb.disputas());
  readonly disputaSeleccionada = signal<DisputaResponse | null>(null);
  readonly resolucionCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] });

  abrirResolucion(d: DisputaResponse): void {
    this.disputaSeleccionada.set(d);
  }

  resolver(acuerdo: boolean): void {
    const d = this.disputaSeleccionada();
    if (!d || this.resolucionCtrl.invalid) return;

    const admin = this.authService.currentUser()?.nombre || 'Administrador COLD DAY';
    this.adminApi.resolverDisputa(d.id, this.resolucionCtrl.value, acuerdo, admin).subscribe({
      next: () => {
        this.toast.success('Disputa Resuelta', `El caso ${d.id} ha sido conciliado satisfactoriamente.`);
        this.disputaSeleccionada.set(null);
        this.resolucionCtrl.reset();
      }
    });
  }
}
