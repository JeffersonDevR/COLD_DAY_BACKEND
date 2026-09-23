import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ProveedoresApi } from '../infrastructure/proveedores-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { ApiHttpError } from '../../../core/shared/infrastructure/api/error.interceptor';
import {
  EstadoRequerimiento,
  OfertaInsumoEstado,
  OfertaInsumoResponse,
} from '../../../core/shared/domain/models/common.models';

type TonoBadge = 'pendiente' | 'ok' | 'error' | 'neutro';

/**
 * Portal del proveedor (rol PROVEEDOR). Lista las ofertas de insumos vigentes
 * con sus líneas, la vigencia de la oferta y el estado resuelto, y expone las
 * acciones aceptar / rechazar / entregar con mensajes humanos para 409, 403 y
 * 404 (nunca fallos silenciosos).
 */
@Component({
  selector: 'app-solicitudes-proveedor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Solicitudes de Insumos
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Despacho de insumos declarados por los técnicos. La primera empresa en aceptar se queda con la solicitud.
          </p>
        </div>
        <button
          type="button"
          (click)="cargar()"
          [disabled]="cargando()"
          class="px-4 py-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-sky-200 dark:hover:bg-sky-900 disabled:opacity-50 transition-colors"
        >
          <i class="pi pi-refresh text-sm" [class.animate-spin]="cargando()"></i>
          Actualizar
        </button>
      </div>

      <!-- Región viva para anunciar el resultado de las acciones asíncronas -->
      <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>

      @if (cargando()) {
        <div class="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" aria-busy="true">
          <i class="pi pi-spin pi-spinner text-3xl text-sky-500"></i>
          <p class="text-xs text-slate-500 mt-2">Consultando tus solicitudes de insumos...</p>
        </div>
      } @else if (errorCarga()) {
        <div class="p-8 text-center rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
          <i class="pi pi-exclamation-triangle text-3xl text-rose-500"></i>
          <h3 class="text-base font-bold text-rose-800 dark:text-rose-200 mt-2">No se pudieron cargar las solicitudes</h3>
          <p class="text-xs text-rose-700 dark:text-rose-300 mt-1">Verifica tu conexión e inténtalo de nuevo.</p>
          <button
            type="button"
            (click)="cargar()"
            class="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
          >
            Reintentar
          </button>
        </div>
      } @else {
        <div class="space-y-4">
          @for (oferta of ofertas(); track oferta.id) {
            <article class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <header class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{{ oferta.id }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold" [class]="claseBadge(tonoOferta(oferta.estado))">
                      {{ etiquetaOferta(oferta.estado) }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">
                    Requerimiento {{ oferta.requerimientoId }}
                    @if (oferta.requerimiento) {
                      · OT {{ oferta.requerimiento.otId }}
                    }
                  </p>
                </div>
                @if (oferta.expiraEn && oferta.estado === 'PENDIENTE') {
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                    <i class="pi pi-clock text-xs"></i>
                    Vence {{ oferta.expiraEn | date:'shortTime' }}
                  </span>
                }
              </header>

              @if (oferta.requerimiento; as requerimiento) {
                <div class="space-y-3">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-slate-500">Estado del requerimiento:</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold" [class]="claseBadge(tonoRequerimiento(requerimiento.estado))">
                      {{ etiquetaRequerimiento(requerimiento.estado) }}
                    </span>
                  </div>

                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Insumos solicitados</h3>
                    <ul class="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                      @for (item of requerimiento.items; track $index) {
                        <li class="flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm">
                          <span class="text-slate-700 dark:text-slate-300">{{ item.descripcion }}</span>
                          <span class="font-bold text-slate-900 dark:text-slate-100">x{{ item.cantidad }}</span>
                        </li>
                      }
                    </ul>
                  </div>

                  @if (requerimiento.observaciones) {
                    <p class="text-xs text-slate-500 leading-relaxed">
                      <span class="font-bold">Observaciones:</span> {{ requerimiento.observaciones }}
                    </p>
                  }
                </div>
              } @else {
                <p class="text-xs text-slate-500">Esta oferta ya fue resuelta y no expone el detalle del requerimiento.</p>
              }

              <!-- Acciones según el estado de la oferta -->
              <div class="pt-2 flex flex-wrap justify-end gap-2">
                @if (oferta.estado === 'PENDIENTE') {
                  <button
                    type="button"
                    [disabled]="accionEnCurso() === oferta.id"
                    (click)="rechazar(oferta)"
                    class="px-4 py-2.5 rounded-2xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-50 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                    [attr.aria-label]="'Rechazar la solicitud ' + oferta.requerimientoId"
                  >
                    <i class="pi pi-times text-sm"></i>
                    Rechazar
                  </button>
                  <button
                    type="button"
                    [disabled]="accionEnCurso() === oferta.id"
                    (click)="aceptar(oferta)"
                    class="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition-colors"
                    [attr.aria-label]="'Aceptar la solicitud ' + oferta.requerimientoId"
                  >
                    @if (accionEnCurso() === oferta.id) {
                      <i class="pi pi-sync animate-spin text-sm"></i>
                      Procesando...
                    } @else {
                      <i class="pi pi-check text-sm"></i>
                      Aceptar solicitud
                    }
                  </button>
                } @else if (oferta.estado === 'ACEPTADA' && oferta.requerimiento?.estado === 'ASIGNADO') {
                  <button
                    type="button"
                    [disabled]="accionEnCurso() === oferta.id"
                    (click)="entregar(oferta)"
                    class="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition-colors"
                    [attr.aria-label]="'Confirmar la entrega del requerimiento ' + oferta.requerimientoId"
                  >
                    @if (accionEnCurso() === oferta.id) {
                      <i class="pi pi-sync animate-spin text-sm"></i>
                      Confirmando...
                    } @else {
                      <i class="pi pi-truck text-sm"></i>
                      Confirmar entrega
                    }
                  </button>
                } @else {
                  <span class="text-xs text-slate-400 italic">Sin acciones disponibles para este estado.</span>
                }
              </div>
            </article>
          } @empty {
            <div class="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <i class="pi pi-inbox text-4xl text-slate-300 dark:text-slate-600 mb-2"></i>
              <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No tienes solicitudes de insumos</h3>
              <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Cuando un técnico declare insumos en un diagnóstico, recibirás la solicitud aquí para aceptarla o rechazarla.
              </p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SolicitudesProveedorPage implements OnInit {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly toast = inject(ToastService);

  readonly ofertas = signal<OfertaInsumoResponse[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);
  readonly anuncio = signal<string>('');
  /** Id de la oferta cuya acción está en vuelo (deshabilita y muestra spinner). */
  readonly accionEnCurso = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.proveedoresApi.getMisSolicitudes().subscribe({
      next: (ofertas) => {
        this.ofertas.set(ofertas);
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set(true);
        this.cargando.set(false);
      },
    });
  }

  aceptar(oferta: OfertaInsumoResponse): void {
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.aceptar(oferta.id).subscribe({
      next: (requerimiento) => {
        this.accionEnCurso.set(null);
        this.anunciar(`Solicitud ${requerimiento.id} aceptada. Estado: ${requerimiento.estado}.`);
        this.toast.success(
          'Solicitud aceptada',
          `Te asignamos el requerimiento ${requerimiento.id}. Coordina la entrega en el sitio del técnico.`
        );
        this.cargar();
      },
      error: (err) => {
        this.accionEnCurso.set(null);
        const mensaje = this.mensajeError(err, 'aceptar');
        this.anunciar(mensaje);
        this.toast.error('No se pudo aceptar', mensaje);
      },
    });
  }

  rechazar(oferta: OfertaInsumoResponse): void {
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.rechazar(oferta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.anunciar(`Solicitud ${oferta.requerimientoId} rechazada.`);
        this.toast.info('Solicitud rechazada', 'Se registró tu rechazo. No quedas vinculado a esta entrega.');
        this.cargar();
      },
      error: (err) => {
        this.accionEnCurso.set(null);
        const mensaje = this.mensajeError(err, 'rechazar');
        this.anunciar(mensaje);
        this.toast.error('No se pudo rechazar', mensaje);
      },
    });
  }

  entregar(oferta: OfertaInsumoResponse): void {
    const requerimientoId = oferta.requerimiento?.id;
    if (!requerimientoId) {
      this.toast.error('Sin requerimiento', 'La oferta no expone el requerimiento a entregar.');
      return;
    }
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.entregar(requerimientoId).subscribe({
      next: (requerimiento) => {
        this.accionEnCurso.set(null);
        this.anunciar(`Entrega del requerimiento ${requerimiento.id} confirmada.`);
        this.toast.success('Entrega confirmada', 'El requerimiento quedó marcado como ENTREGADO.');
        this.cargar();
      },
      error: (err) => {
        this.accionEnCurso.set(null);
        const mensaje = this.mensajeError(err, 'entregar');
        this.anunciar(mensaje);
        this.toast.error('No se pudo confirmar la entrega', mensaje);
      },
    });
  }

  /** Traduce el error del backend a un mensaje humano según el status HTTP. */
  private mensajeError(err: unknown, accion: 'aceptar' | 'rechazar' | 'entregar'): string {
    if (err instanceof ApiHttpError) {
      switch (err.status) {
        case 409:
          return accion === 'aceptar'
            ? 'Otra empresa tomó esta solicitud primero.'
            : 'Esta solicitud ya fue gestionada por otro proveedor.';
        case 403:
          return 'Tu cuenta no está habilitada para operar despachos de insumos.';
        case 404:
          return accion === 'entregar'
            ? 'No existe un requerimiento asignado a tu empresa con ese identificador.'
            : 'La solicitud ya no está disponible.';
        default:
          return err.message;
      }
    }
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  private anunciar(mensaje: string): void {
    this.anuncio.set(mensaje);
  }

  etiquetaOferta(estado: OfertaInsumoEstado): string {
    switch (estado) {
      case 'PENDIENTE': return 'Pendiente';
      case 'ACEPTADA': return 'Aceptada';
      case 'RECHAZADO': return 'Rechazada';
      case 'EXPIRADA': return 'Expirada';
      case 'CANCELADA': return 'Cancelada';
    }
  }

  tonoOferta(estado: OfertaInsumoEstado): TonoBadge {
    switch (estado) {
      case 'PENDIENTE': return 'pendiente';
      case 'ACEPTADA': return 'ok';
      case 'RECHAZADO': return 'error';
      case 'EXPIRADA':
      case 'CANCELADA': return 'neutro';
    }
  }

  etiquetaRequerimiento(estado: EstadoRequerimiento): string {
    switch (estado) {
      case 'SOLICITADO': return 'Solicitado';
      case 'ASIGNADO': return 'Asignado';
      case 'ENTREGADO': return 'Entregado';
      case 'SIN_PROVEEDOR': return 'Sin proveedor';
    }
  }

  tonoRequerimiento(estado: EstadoRequerimiento): TonoBadge {
    switch (estado) {
      case 'SOLICITADO': return 'pendiente';
      case 'ASIGNADO': return 'ok';
      case 'ENTREGADO': return 'ok';
      case 'SIN_PROVEEDOR': return 'error';
    }
  }

  claseBadge(tono: TonoBadge): string {
    switch (tono) {
      case 'pendiente': return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
      case 'ok': return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
      case 'error': return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300';
      case 'neutro': return 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  }
}
