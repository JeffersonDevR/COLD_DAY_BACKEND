import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';

interface EquipoHistorial {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  ultimaIntervencion: string;
  repuestosInstalados: string[];
  garantiaActiva: boolean;
  diasGarantiaRestantes: number;
  tecnicoResponsable: string;
  otId: string;
}

@Component({
  selector: 'app-historial-equipos-page',
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
            Historial de Equipos y Garantías
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Inventario técnico de equipos intervenidos, bitácora de repuestos y vigencia de garantías
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @for (eq of equipos(); track eq.id) {
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:border-sky-300 transition-all">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <mat-icon class="text-2xl">
                    @switch (eq.tipo) {
                      @case ('Aire Acondicionado') { mode_fan }
                      @case ('Nevera / Refrigeración') { kitchen }
                      @case ('Lavadora') { local_laundry_service }
                      @default { hvac }
                    }
                  </mat-icon>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ eq.tipo }}</h3>
                  <p class="text-xs text-slate-500">{{ eq.marca }} {{ eq.modelo }} • {{ eq.ubicacion }}</p>
                </div>
              </div>

              @if (eq.garantiaActiva) {
                <span class="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1">
                  <mat-icon class="text-xs" style="font-size:12px; width:12px; height:12px;">verified</mat-icon>
                  {{ eq.diasGarantiaRestantes }} días garantía
                </span>
              } @else {
                <span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold">
                  Garantía Vencida
                </span>
              }
            </div>

            <!-- Intervención y Repuestos -->
            <div class="space-y-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <div class="flex justify-between">
                <span class="text-slate-500">Último Servicio:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ eq.ultimaIntervencion }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Técnico Acreditado:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">{{ eq.tecnicoResponsable }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Orden de Trabajo:</span>
                <a [routerLink]="['/cliente/ot', eq.otId]" class="font-bold text-sky-600 hover:underline">
                  OT: {{ eq.otId }}
                </a>
              </div>
            </div>

            <!-- Repuestos instalados -->
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Repuestos Homologados Instalados:
              </span>
              <div class="flex flex-wrap gap-1.5">
                @for (rep of eq.repuestosInstalados; track rep) {
                  <span class="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-medium border border-sky-200/60 dark:border-sky-800/60">
                    {{ rep }}
                  </span>
                }
              </div>
            </div>

            <div class="pt-2 flex justify-end">
              <a
                [routerLink]="['/cliente/solicitar']"
                class="text-xs font-bold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1"
              >
                Solicitar Mantenimiento para este equipo
                <mat-icon class="text-xs">arrow_forward</mat-icon>
              </a>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class HistorialEquiposPage {
  readonly authService = inject(AuthService);

  readonly equipos = signal<EquipoHistorial[]>([
    {
      id: 'EQ-01',
      tipo: 'Aire Acondicionado',
      marca: 'LG Dual Inverter 12.000 BTU',
      modelo: 'VM121C6',
      ubicacion: 'Habitación Principal (Los Caobos)',
      ultimaIntervencion: '15 de Mayo 2026',
      repuestosInstalados: ['Capacitor 45uF CBB65', 'Gas R410A (1.5 lb)', 'Filtro deshidratador'],
      garantiaActiva: true,
      diasGarantiaRestantes: 68,
      tecnicoResponsable: 'Juan Pérez (SENA)',
      otId: 'OT-8821'
    },
    {
      id: 'EQ-02',
      tipo: 'Nevera / Refrigeración',
      marca: 'Whirlpool No-Frost 420L',
      modelo: 'WRX-48D',
      ubicacion: 'Cocina',
      ultimaIntervencion: '28 de Abril 2026',
      repuestosInstalados: ['Sensor bimetálico de descongelación', 'Resistencia tubular 110V'],
      garantiaActiva: true,
      diasGarantiaRestantes: 51,
      tecnicoResponsable: 'Andrés Silva (CONTE)',
      otId: 'OT-8822'
    },
    {
      id: 'EQ-03',
      tipo: 'Lavadora',
      marca: 'Samsung Wobble 18Kg',
      modelo: 'WA18F7L4',
      ubicacion: 'Área de Ropas',
      ultimaIntervencion: '10 de Febrero 2026',
      repuestosInstalados: ['Bomba de drenaje magnética', 'Correa de transmisión'],
      garantiaActiva: false,
      diasGarantiaRestantes: 0,
      tecnicoResponsable: 'Juan Pérez (SENA)',
      otId: 'OT-8819'
    }
  ]);
}
