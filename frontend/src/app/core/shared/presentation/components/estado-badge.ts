import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EstadoOt, EstadoOperativo, EstadoValidacion, EstadoLiquidacion, EstadoDisputa } from '../../domain/models/common.models';

type AnyEstado = EstadoOt | EstadoOperativo | EstadoValidacion | EstadoLiquidacion | EstadoDisputa | string;

@Component({
  selector: 'app-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span
      [class]="badgeClasses()"
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap"
    >
      @if (showIcon() && iconName()) {
        <mat-icon class="text-xs leading-none" style="font-size: 14px; width: 14px; height: 14px;">{{ iconName() }}</mat-icon>
      }
      {{ label() }}
    </span>
  `
})
export class EstadoBadge {
  readonly estado = input.required<AnyEstado>();
  readonly showIcon = input<boolean>(true);

  readonly label = computed<string>(() => {
    const val = this.estado();
    switch (val) {
      // Estado OT
      case 'SOLICITADA': return 'Solicitada';
      case 'BUSCANDO_TECNICO': return 'Buscando Técnico';
      case 'ASIGNADA': return 'Asignada';
      case 'EN_CAMINO': return 'En Camino';
      case 'EN_DIAGNOSTICO': return 'En Diagnóstico';
      case 'EN_REPARACION': return 'En Reparación';
      case 'FINALIZADA': return 'Finalizada';
      case 'CANCELADA': return 'Cancelada';
      case 'SIN_TECNICOS_DISPONIBLES': return 'Sin Técnicos';
      case 'DISPUTADA': return 'En Disputa';

      // Estado Operativo Técnico
      case 'DISPONIBLE': return 'Disponible';
      case 'OCUPADO': return 'En Servicio';
      case 'FUERA_DE_SERVICIO': return 'Fuera de Servicio';
      case 'BLOQUEADO_POR_LIQUIDACION': return 'Bloqueado por Liquidación';

      // Estado Validación
      case 'APROBADO': return 'Aprobado';
      case 'PENDIENTE': return 'Pendiente';
      case 'RECHAZADO': return 'Rechazado';
      case 'SUSPENDIDO': return 'Suspendido';

      // Liquidación
      case 'PENDIENTE_CONSIGNACION': return 'Pendiente';
      case 'EN_VERIFICACION': return 'En Verificación';

      // Disputa
      case 'ABIERTA': return 'Abierta';
      case 'RESUELTA_CON_ACUERDO': return 'Resuelta (Acuerdo)';
      case 'RESUELTA_SIN_ACUERDO': return 'Resuelta (Sin Acuerdo)';

      default: return String(val);
    }
  });

  readonly iconName = computed<string>(() => {
    const val = this.estado();
    switch (val) {
      case 'SOLICITADA':
      case 'BUSCANDO_TECNICO': return 'radar';
      case 'ASIGNADA': return 'person_pin';
      case 'EN_CAMINO': return 'two_wheeler';
      case 'EN_DIAGNOSTICO': return 'build';
      case 'EN_REPARACION': return 'handyman';
      case 'FINALIZADA':
      case 'APROBADO':
      case 'RESUELTA_CON_ACUERDO': return 'check_circle';
      case 'CANCELADA':
      case 'RECHAZADO':
      case 'RESUELTA_SIN_ACUERDO': return 'cancel';
      case 'DISPUTADA':
      case 'BLOQUEADO_POR_LIQUIDACION': return 'gavel';
      case 'DISPONIBLE': return 'check';
      case 'OCUPADO': return 'engineering';
      case 'PENDIENTE':
      case 'PENDIENTE_CONSIGNACION':
      case 'EN_VERIFICACION': return 'schedule';
      default: return 'info';
    }
  });

  readonly badgeClasses = computed<string>(() => {
    const val = this.estado();
    switch (val) {
      case 'FINALIZADA':
      case 'APROBADO':
      case 'DISPONIBLE':
      case 'RESUELTA_CON_ACUERDO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40';

      case 'BUSCANDO_TECNICO':
      case 'EN_CAMINO':
      case 'ASIGNADA':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300/40 animate-pulse';

      case 'EN_DIAGNOSTICO':
      case 'EN_REPARACION':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/40';

      case 'PENDIENTE':
      case 'PENDIENTE_CONSIGNACION':
      case 'SOLICITADA':
      case 'EN_VERIFICACION':
      case 'OCUPADO':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40';

      case 'DISPUTADA':
      case 'BLOQUEADO_POR_LIQUIDACION':
      case 'ABIERTA':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-300/40 font-bold';

      case 'CANCELADA':
      case 'RECHAZADO':
      case 'SIN_TECNICOS_DISPONIBLES':
      case 'RESUELTA_SIN_ACUERDO':
      case 'FUERA_DE_SERVICIO':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40';

      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/40';
    }
  });
}
