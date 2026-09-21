import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { TecnicosApi } from '../infrastructure/tecnicos-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-ofertas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between">
        <div>
          <a routerLink="/panel" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <mat-icon class="text-xs">arrow_back</mat-icon> Volver al Panel
          </a>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Radar de Ofertas Broadcast en Vivo
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Perímetro metropolitano de Cúcuta • Asignación atómica ("El primero gana")
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Escuchando Broadcast
          </span>
        </div>
      </div>

      <!-- Alerta si técnico está bloqueado -->
      @if (tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
        <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-rose-600">lock</mat-icon>
            <span>Tu cuenta está bloqueada por comisiones pendientes de liquidación. No podrás aceptar solicitudes.</span>
          </div>
          <a routerLink="/tecnico/liquidaciones" class="font-bold underline ml-2">Legalizar</a>
        </div>
      }

      <!-- Bandeja de Ofertas Disponibles -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (ot of solicitudesDisponibles(); track ot.id) {
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden hover:border-sky-400 transition-all">
            <!-- Barra superior con cuenta regresiva -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span class="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{{ ot.id }}</span>
              <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                <mat-icon class="text-xs" style="font-size: 14px; width:14px; height:14px;">timer</mat-icon>
                <span>42s restantes</span>
              </div>
            </div>

            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {{ ot.categoriaServicio.replace('_', ' ') }}
                </span>
                <span class="text-xs text-slate-400">• Distancia aprox: 2.8 km</span>
              </div>

              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                Falla Reportada
              </h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {{ ot.descripcionFalla }}
              </p>
            </div>

            <!-- Ubicación del Cliente -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
              <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                <mat-icon class="text-xs text-sky-600">location_on</mat-icon>
                <span>{{ ot.direccion }} ({{ ot.barrio || 'Cúcuta' }})</span>
              </div>
              <div class="flex items-center gap-1 text-slate-500">
                <mat-icon class="text-xs">person</mat-icon>
                <span>Cliente: {{ ot.clienteNombre }}</span>
              </div>
            </div>

            <!-- Botón de Aceptación Inmediata -->
            <div class="pt-2 flex justify-end">
              <button
                type="button"
                [disabled]="tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION' || loadingOt() === ot.id"
                (click)="aceptarOferta(ot)"
                class="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                @if (loadingOt() === ot.id) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                  Confirmando asignación atómica...
                } @else {
                  <mat-icon class="text-sm">handshake</mat-icon>
                  Aceptar Servicio Inmediato
                }
              </button>
            </div>
          </div>
        }

        @if (solicitudesDisponibles().length === 0) {
          <div class="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <mat-icon class="text-4xl text-slate-300 dark:text-slate-600 mb-2">radar</mat-icon>
            <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No hay órdenes en broadcast en este momento</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
              El radar monitorea permanentemente las solicitudes de clientes en Cúcuta y te notificará apenas ingrese un requerimiento en tu perímetro.
            </p>
            <button
              type="button"
              (click)="recargarOfertas()"
              class="mt-4 px-4 py-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold text-xs inline-flex items-center gap-1 hover:bg-sky-200 transition-colors"
            >
              <mat-icon class="text-sm">refresh</mat-icon>
              Actualizar Radar
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class OfertasPage {
  private readonly authService = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loadingOt = signal<string | null>(null);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly ofertas = signal<OfertaTecnicoResponse[]>([]);

  readonly solicitudesDisponibles = computed(() => this.ofertas().map(oferta => oferta.ot));

  constructor() {
    const usuarioId = Number(this.authService.currentUser()?.id ?? 0);
    this.tecnicosApi.getTecnicoPorUsuarioId(usuarioId).subscribe({
      next: (tecnico) => {
        this.tecnico.set(tecnico);
        if (tecnico) {
          this.cargarOfertas(tecnico.id);
        }
      },
      error: () => this.toast.error('Error', 'No se pudo cargar tu perfil de técnico.'),
    });
  }

  private cargarOfertas(tecnicoId: string): void {
    this.tecnicosApi.getOfertasParaTecnico(tecnicoId).subscribe({
      next: (ofertas) => this.ofertas.set(ofertas),
      error: () => this.toast.error('Error de Conexión', 'No se pudieron consultar las ofertas disponibles.'),
    });
  }

  recargarOfertas(): void {
    const tecnico = this.tecnico();
    if (tecnico) {
      this.cargarOfertas(tecnico.id);
    }
  }

  aceptarOferta(ot: OtResponse): void {
    const tecnico = this.tecnico();
    if (!tecnico) {
      this.toast.error('Error', 'No se encontró el perfil de técnico.');
      return;
    }

    if (tecnico.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
      this.toast.error('Operación Bloqueada', 'Debes legalizar tus liquidaciones pendientes para tomar servicios.');
      return;
    }

    const oferta = this.ofertas().find(o => o.otId === ot.id);
    if (!oferta) {
      this.toast.error('Sin Oferta Vigente', `No hay una oferta activa para la orden ${ot.id}. Puede que ya haya sido tomada.`);
      return;
    }

    this.loadingOt.set(ot.id);
    this.tecnicosApi.aceptarOferta(oferta.id, tecnico.id).subscribe({
      next: () => {
        this.loadingOt.set(null);
        this.toast.success('¡Servicio Asignado!', `Has tomado la orden ${ot.id}. Desplázate al domicilio.`);
        this.router.navigate(['/tecnico/ejecucion', ot.id]);
      },
      error: () => {
        this.loadingOt.set(null);
        this.toast.error('Error de Concurrencia', 'Esta orden ya fue tomada por otro técnico en el perímetro.');
      }
    });
  }
}
