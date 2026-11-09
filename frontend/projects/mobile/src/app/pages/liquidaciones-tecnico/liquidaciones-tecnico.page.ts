import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { LiquidacionResponse } from '@core/models/common.models';
import { LiquidacionApi } from '@core/service/liquidacion-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { estadoLiquidacionLabel, medioPagoLabel } from '@core/ui/labels';

/**
 * B5 — Liquidaciones del técnico.
 *
 * Lee `GET /api/tecnicos/me/liquidaciones` (el backend resuelve el técnico del
 * JWT, así que no se envía ningún id). Es de solo lectura a propósito: el
 * comprobante de consignación se registra desde la web, donde existe el flujo de
 * carga; la app sirve para que el técnico sepa cuánto debe y en qué estado está
 * cada servicio.
 *
 * El endpoint ya devuelve `otCodigo`, así que la lista se lee sin mostrar UUID.
 */
@Component({
  selector: 'app-liquidaciones-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonToolbar,
  ],
  templateUrl: './liquidaciones-tecnico.page.html',
})
export class LiquidacionesTecnicoPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly liquidacionApi = inject(LiquidacionApi);

  readonly liquidaciones = signal<LiquidacionResponse[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal(false);

  /** Comisión que el técnico todavía tiene que consignar. */
  readonly porConsignar = computed(() =>
    this.liquidaciones()
      .filter((liq) => liq.estado === 'PENDIENTE_CONSIGNACION')
      .reduce((total, liq) => total + (liq.comision ?? 0), 0),
  );

  readonly enVerificacion = computed(
    () => this.liquidaciones().filter((liq) => liq.estado === 'EN_VERIFICACION').length,
  );
  readonly aprobadas = computed(
    () => this.liquidaciones().filter((liq) => liq.estado === 'APROBADA').length,
  );

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Pull-to-refresh de Ionic: el `complete()` va en el elemento que emite el
   * evento (`event.target`), no en el `detail`.
   */
  recargar(event: Event): void {
    const refresher = event.target as unknown as { complete?: () => unknown } | null;
    this.cargar(() => {
      refresher?.complete?.();
    });
  }

  reintentar(): void {
    this.cargar();
  }

  private cargar(alTerminar?: () => void): void {
    this.cargando.set(true);
    this.fallo.set(false);
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        if (!tecnico) {
          this.fallar(alTerminar);
          return;
        }
        this.liquidacionApi.getLiquidacionesPorTecnico(tecnico.id).subscribe({
          next: (lista) => {
            this.liquidaciones.set(lista);
            this.cargando.set(false);
            alTerminar?.();
          },
          error: () => this.fallar(alTerminar),
        });
      },
      () => this.fallar(alTerminar),
    );
  }

  private fallar(alTerminar?: () => void): void {
    // El error no borra la lista previa: si había datos, se quedan en pantalla.
    this.fallo.set(true);
    this.cargando.set(false);
    alTerminar?.();
  }

  etiquetaEstado(estado: LiquidacionResponse['estado']): string {
    return estadoLiquidacionLabel(estado);
  }

  etiquetaMedio(medio: LiquidacionResponse['medioPago']): string {
    return medioPagoLabel(medio);
  }

  /** Tono del chip, con las clases `cd-chip--*` del sistema de diseño. */
  tonoEstado(estado: LiquidacionResponse['estado']): string {
    switch (estado) {
      case 'APROBADA':
        return 'ok';
      case 'RECHAZADA':
        return 'cerrada';
      case 'EN_VERIFICACION':
        return 'curso';
      default:
        return 'espera';
    }
  }

  fecha(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime())
      ? '—'
      : fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Montos sin decimales: el COP no se usa con centavos en la operación. */
  cop(valor?: number): string {
    return (valor ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
}
