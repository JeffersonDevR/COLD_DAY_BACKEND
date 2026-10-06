import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import {
  EstadoRequerimiento,
  OfertaInsumoEstado,
  OfertaInsumoResponse,
} from '../../core/models/common.models';

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
  imports: [DatePipe, RouterLink],
  templateUrl: './solicitudes-proveedor-page.html'
})
export class SolicitudesProveedorPage implements OnInit {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly toast = inject(ToastService);

  readonly ofertas = signal<OfertaInsumoResponse[]>([]);
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);
  /** true cuando el 403 viene del gate de validación documental, no de la red. */
  readonly validacionBloquea = signal<boolean>(false);
  readonly anuncio = signal<string>('');
  /** Id de la oferta cuya acción está en vuelo (deshabilita y muestra spinner). */
  readonly accionEnCurso = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.validacionBloquea.set(false);
    this.proveedoresApi.getMisSolicitudes().subscribe({
      next: (ofertas) => {
        this.ofertas.set(ofertas);
        this.cargando.set(false);
      },
      error: (err) => {
        this.errorCarga.set(true);
        // 403 aquí significa "el gate de validación documental te cierra el paso"
        // (exigirValidado), no una caída de red: decirlo evita que un proveedor
        // recién registrado repita "Actualizar" esperando unmilagro.
        this.validacionBloquea.set(
          err instanceof ApiHttpError && err.status === 403
        );
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
