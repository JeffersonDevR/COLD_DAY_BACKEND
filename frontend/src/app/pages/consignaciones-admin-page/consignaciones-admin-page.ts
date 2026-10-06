import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LiquidacionApi } from '../../modules/liquidacion/infrastructure/liquidacion-api';
import { TecnicosApi } from '../../modules/tecnicos/infrastructure/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { LiquidacionResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

@Component({
  selector: 'app-consignaciones-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './consignaciones-admin-page.html'
})
export class ConsignacionesAdminPage {
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  /** Comisión de la plataforma (15%), alineada al backend. */
  readonly comisionPorcentaje = Math.round(environment.commissionRate * 100);

  readonly liquidaciones = signal<LiquidacionResponse[]>([]);
  readonly tecnicos = signal<TecnicoResponse[]>([]);

  readonly enVerificacion = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'EN_VERIFICACION')
  );

  readonly tecnicosBloqueados = computed(() =>
    this.tecnicos().filter(t => t.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION')
  );

  readonly totalComisionesAprobadas = computed(() =>
    this.liquidaciones().filter(l => l.estado === 'APROBADA').reduce((acc, l) => acc + l.comision, 0)
  );

  readonly liqARechazar = signal<LiquidacionResponse | null>(null);
  readonly motivoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  constructor() {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.liquidacionApi.getTodasLiquidaciones().subscribe({
      next: (liquidaciones) => this.liquidaciones.set(liquidaciones),
      error: () => this.liquidaciones.set([]),
    });
    this.tecnicosApi.getTecnicos().subscribe({
      next: (tecnicos) => this.tecnicos.set(tecnicos),
      error: () => this.tecnicos.set([]),
    });
  }

  aprobar(liq: LiquidacionResponse): void {
    this.liquidacionApi.aprobarLiquidacion(liq.id).subscribe({
      next: () => {
        this.toast.success('Conciliación Aprobada', `Comisión acreditada. El técnico ${liq.tecnicoNombre ?? ''} ha sido habilitado.`);
        this.cargarDatos();
      }
    });
  }

  abrirRechazo(liq: LiquidacionResponse): void {
    this.liqARechazar.set(liq);
  }

  confirmarRechazo(): void {
    const liq = this.liqARechazar();
    if (!liq || this.motivoCtrl.invalid) return;

    this.liquidacionApi.rechazarLiquidacion(liq.id, this.motivoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Liquidación Rechazada', 'Se notificó al técnico para que suba un comprobante válido.');
        this.liqARechazar.set(null);
        this.motivoCtrl.reset();
        this.cargarDatos();
      }
    });
  }
}
