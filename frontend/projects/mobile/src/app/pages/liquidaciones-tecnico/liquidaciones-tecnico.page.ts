import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { DocumentoTecnico, LiquidacionResponse, TipoDocumentoTecnico } from '@core/models/common.models';
import { LiquidacionApi } from '@core/service/liquidacion-api';
import { ResumenVigencia, resumenVigencia } from '@core/service/documentos-vigencia';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { TecnicosApi } from '@core/service/tecnicos-api';
import {
  documentoLabel,
  estadoLiquidacionLabel,
  estadoValidacionLabel,
  medioPagoLabel,
} from '@core/ui/labels';
import { MobileToastService } from '../../core/toast.service';
import { DocumentoFormComponent, DeclaracionDocumento, OpcionTipoDocumento } from '../../shared/ui/documento-form/documento-form';
import { DocumentoVista, DocumentosListaComponent } from '../../shared/ui/documentos-lista/documentos-lista';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { PageComponent } from '../../shared/ui/page/page';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * B5 — Gestión del técnico: liquidaciones + documentos en un solo tab.
 *
 * Lee `GET /api/tecnicos/me/liquidaciones` (el backend resuelve el técnico del
 * JWT, así que no se envía ningún id). Es de solo lectura a propósito: el
 * comprobante de consignación se registra desde la web, donde existe el flujo de
 * carga; la app sirve para que el técnico sepa cuánto debe y en qué estado está
 * cada servicio.
 *
 * Los documentos de validación viven acá junto a la plata (petición del dueño
 * 2026-11-23): el perfil queda para identidad y especialidades. Los documentos
 * van primero (lo que el técnico necesita para operar) y las liquidaciones en un
 * plegable; lo urgente de cada bloque (deuda por consignar, documentos vencidos)
 * se avisa arriba, fuera del plegable.
 *
 * El técnico declara sus documentos desde la app (tipo y fechas, como en la web):
 * el backend no recibe el archivo.
 *
 * El endpoint ya devuelve `otCodigo`, así que la lista se lee sin mostrar UUID.
 */
@Component({
  selector: 'app-liquidaciones-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonHeader,
    IonIcon,
    PageComponent,
    DocumentoFormComponent,
    DocumentosListaComponent,
    IonRefresher,
    IonRefresherContent,
    IonToolbar,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    MarcaBarraComponent,
  ],
  templateUrl: './liquidaciones-tecnico.page.html',
})
export class LiquidacionesTecnicoPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly liquidacionApi = inject(LiquidacionApi);
  private readonly toast = inject(MobileToastService);

  /** Tipos que el técnico puede declarar (el heredado `ANTECEDENTES` ya no se ofrece). */
  readonly tiposDocumento: readonly OpcionTipoDocumento[] = (
    [
      'CEDULA',
      'ANTECEDENTES_POLICIA',
      'CERTIFICACION_CONTE',
      'CERTIFICACION_SENA',
      'MATRICULA_CONTE',
      'RUT',
      'OTRO',
    ] as const
  ).map((valor) => ({ valor, etiqueta: documentoLabel(valor) }));

  private readonly tecnicoId = signal<string | null>(null);
  readonly mostrarFormulario = signal(false);
  readonly guardandoDocumento = signal(false);
  readonly liquidacionesAbiertas = signal(false);

  readonly liquidaciones = signal<LiquidacionResponse[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal(false);

  /** Documentos de validación del técnico (antes vivían en el perfil). */
  readonly documentos = signal<DocumentoTecnico[]>([]);

  readonly documentosVista = computed<DocumentoVista[]>(() =>
    this.documentos().map((documento) => ({
      id: documento.id,
      titulo: documento.tipo ? documentoLabel(documento.tipo) : documento.nombre,
      expedicion: documento.fechaExpedicion,
      vencimiento: documento.fechaVencimiento,
      estadoTexto: estadoValidacionLabel(documento.estadoValidacion),
      estadoTono: this.tonoDocumento(documento) as DocumentoVista['estadoTono'],
      observaciones: documento.observaciones,
    })),
  );

  readonly resumenDocumentos = computed<ResumenVigencia>(() =>
    resumenVigencia(this.documentos().map((d) => ({ fechaVencimiento: d.fechaVencimiento }))),
  );

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
    this.cargarDocumentos();
  }

  private cargarDocumentos(): void {
    this.tecnicosApi.getMisDocumentos().subscribe({
      next: (documentos) => this.documentos.set(documentos),
      error: () => this.documentos.set([]),
    });
  }

  alternarFormulario(): void {
    this.mostrarFormulario.update((abierto) => !abierto);
  }

  alternarLiquidaciones(): void {
    this.liquidacionesAbiertas.update((abiertas) => !abiertas);
  }

  /** "1 vencido y 2 por vencer", para el aviso de arriba. */
  textoAvisoDocumentos(resumen: ResumenVigencia): string {
    const partes: string[] = [];
    if (resumen.vencidos > 0) {
      partes.push(`${resumen.vencidos} ${resumen.vencidos === 1 ? 'vencido' : 'vencidos'}`);
    }
    if (resumen.porVencer > 0) {
      partes.push(`${resumen.porVencer} por vencer`);
    }
    return `Tienes ${partes.join(' y ')}. Renuévalos para no perder la validación.`;
  }

  declararDocumento(declaracion: DeclaracionDocumento): void {
    const tecnicoId = this.tecnicoId();
    if (!declaracion.fechaExpedicion) {
      void this.toast.warning('Falta la fecha de expedición', 'Indica cuándo se expidió el documento.');
      return;
    }
    if (!tecnicoId) {
      void this.toast.error('No pudimos declarar el documento', 'No encontramos tu perfil de técnico.');
      return;
    }
    if (this.guardandoDocumento()) return;

    this.guardandoDocumento.set(true);
    // El backend guarda tipo y fechas; el archivo no viaja (cadena vacía).
    this.tecnicosApi
      .subirDocumento(
        tecnicoId,
        declaracion.tipo as TipoDocumentoTecnico,
        '',
        declaracion.fechaExpedicion,
        declaracion.fechaVencimiento,
      )
      .subscribe({
        next: () => {
          this.guardandoDocumento.set(false);
          this.mostrarFormulario.set(false);
          this.cargarDocumentos();
          void this.toast.success('Documento declarado', 'Un administrador va a revisar tu expediente.');
        },
        error: (err: Error) => {
          this.guardandoDocumento.set(false);
          void avisarErrorAccion(this.toast, 'No se pudo declarar el documento', err);
        },
      });
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
        this.tecnicoId.set(tecnico.id);
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

  etiquetaMedio(medio?: LiquidacionResponse['medioPago']): string {
    return medio ? medioPagoLabel(medio) : '—';
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

  etiquetaDocumento(tipo: TipoDocumentoTecnico): string {
    return documentoLabel(tipo);
  }

  tonoDocumento(documento: DocumentoTecnico): string {
    switch (documento.estadoValidacion) {
      case 'APROBADO':
        return 'ok';
      case 'RECHAZADO':
      case 'SUSPENDIDO':
        return 'cerrada';
      default:
        return 'espera';
    }
  }
}
