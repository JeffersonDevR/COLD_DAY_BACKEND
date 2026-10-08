import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { LiquidacionApi } from '../../core/service/liquidacion-api';
import { ToastService } from '../../core/alertas/toast.service';
import { EstadoLiquidacion, LiquidacionResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

@Component({
  selector: 'app-liquidaciones-tecnico-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './liquidaciones-tecnico-page.html',
})
export class LiquidacionesTecnicoPage {
  private readonly authService = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly toast = inject(ToastService);

  /** Expuesto al template para derivar las etiquetas de comisión. */
  readonly environment = environment;

  readonly liqSeleccionada = signal<LiquidacionResponse | null>(null);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly misLiquidaciones = signal<LiquidacionResponse[]>([]);

  constructor() {
    cargarTecnicoAutenticado(this.tecnicosApi, (tecnico) => this.tecnico.set(tecnico));
    this.cargarLiquidaciones(Number(this.authService.currentUser()?.id ?? 0));
  }

  readonly estaBloqueado = computed(() =>
    this.tecnico()?.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION' || this.deudaTotal() > 0
  );

  private readonly estadosPendientes = new Set<EstadoLiquidacion>([
    'PENDIENTE_CONSIGNACION',
    'EN_VERIFICACION',
    'RECHAZADA',
  ]);

  readonly deudaTotal = computed(() =>
    this.misLiquidaciones()
      .filter(l => this.estadosPendientes.has(l.estado))
      .reduce((acc, l) => acc + l.comision, 0)
  );

  readonly totalRecaudado = computed(() => {
    return this.misLiquidaciones().reduce((acc, l) => acc + l.montoServicio, 0);
  });

  private cargarLiquidaciones(usuarioId: number): void {
    this.liquidacionApi.getLiquidacionesPorTecnico(String(usuarioId)).subscribe({
      next: (liquidaciones) => this.misLiquidaciones.set(liquidaciones),
      error: () => this.misLiquidaciones.set([]),
    });
  }

  readonly comprobanteForm = new FormGroup({
    referencia: new FormControl('BCOL-8492048', { nonNullable: true, validators: [Validators.required] }),
    comprobanteUrl: new FormControl('https://coldday.com.co/recibos/consignacion-bancolombia.jpg', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  abrirSubida(liq: LiquidacionResponse): void {
    this.liqSeleccionada.set(liq);
  }

  enviarComprobante(): void {
    if (this.comprobanteForm.invalid) return;
    const liq = this.liqSeleccionada();
    if (!liq) return;

    const val = this.comprobanteForm.getRawValue();
    this.liquidacionApi.subirComprobante(liq.id, val.comprobanteUrl, val.referencia).subscribe({
      next: () => {
        this.toast.success('Comprobante Registrado', 'Pasa a cola de conciliación contable de COLD DAY.');
        this.liqSeleccionada.set(null);
        this.cargarLiquidaciones(Number(this.authService.currentUser()?.id ?? 0));
      }
    });
  }

  copiarDatosBanco(): void {
    navigator.clipboard?.writeText('Bancolombia Cuenta Corriente: 084-920148-12 Convenio 78492 NIT 901849201');
    this.toast.info('Copiado', 'Datos bancarios copiados al portapapeles.');
  }
}
