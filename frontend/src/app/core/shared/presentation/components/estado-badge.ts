import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { EstadoOt, EstadoOperativo, EstadoValidacion, EstadoLiquidacion, EstadoDisputa } from '../../domain/models/common.models';

type AnyEstado = EstadoOt | EstadoOperativo | EstadoValidacion | EstadoLiquidacion | EstadoDisputa;
type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

@Component({
  selector: 'app-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tag],
  template: `
    <p-tag
      [value]="label()"
      [severity]="severity()"
      [icon]="showIcon() ? iconClass() : undefined"
      [rounded]="true"
    />
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

  readonly iconClass = computed<string>(() => {
    const val = this.estado();
    switch (val) {
      case 'SOLICITADA':
      case 'BUSCANDO_TECNICO': return 'pi pi-compass';
      case 'ASIGNADA': return 'pi pi-user';
      case 'EN_CAMINO': return 'pi pi-truck';
      case 'EN_DIAGNOSTICO': return 'pi pi-wrench';
      case 'EN_REPARACION': return 'pi pi-hammer';
      case 'FINALIZADA':
      case 'APROBADO':
      case 'RESUELTA_CON_ACUERDO': return 'pi pi-check-circle';
      case 'CANCELADA':
      case 'RECHAZADO':
      case 'RESUELTA_SIN_ACUERDO': return 'pi pi-times-circle';
      case 'DISPUTADA':
      case 'BLOQUEADO_POR_LIQUIDACION': return 'pi pi-shield';
      case 'DISPONIBLE': return 'pi pi-check';
      case 'OCUPADO': return 'pi pi-wrench';
      case 'PENDIENTE':
      case 'PENDIENTE_CONSIGNACION':
      case 'EN_VERIFICACION': return 'pi pi-clock';
      default: return 'pi pi-info-circle';
    }
  });

  readonly severity = computed<TagSeverity>(() => {
    const val = this.estado();
    switch (val) {
      case 'FINALIZADA':
      case 'APROBADO':
      case 'DISPONIBLE':
      case 'RESUELTA_CON_ACUERDO':
        return 'success';

      case 'BUSCANDO_TECNICO':
      case 'EN_CAMINO':
      case 'ASIGNADA':
      case 'EN_DIAGNOSTICO':
      case 'EN_REPARACION':
        return 'info';

      case 'PENDIENTE':
      case 'PENDIENTE_CONSIGNACION':
      case 'SOLICITADA':
      case 'EN_VERIFICACION':
      case 'OCUPADO':
        return 'warn';

      case 'DISPUTADA':
      case 'BLOQUEADO_POR_LIQUIDACION':
      case 'ABIERTA':
      case 'CANCELADA':
      case 'RECHAZADO':
      case 'SIN_TECNICOS_DISPONIBLES':
      case 'RESUELTA_SIN_ACUERDO':
      case 'FUERA_DE_SERVICIO':
        return 'danger';

      default:
        return 'secondary';
    }
  });
}
