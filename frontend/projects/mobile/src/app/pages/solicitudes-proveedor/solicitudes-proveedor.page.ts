import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { mensajeErrorAccion } from '@core/alertas/mensaje-error';
import {
  EstadoRequerimiento,
  OfertaInsumoEstado,
  OfertaInsumoResponse,
} from '@core/models/common.models';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileToastService } from '../../core/toast.service';

/** C1 — Provider portal: insumos requests with accept/reject/deliver. */
@Component({
  selector: 'app-solicitudes-proveedor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonSpinner, IonToolbar],
  templateUrl: './solicitudes-proveedor.page.html',
})
export class SolicitudesProveedorPage implements OnInit {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly toast = inject(MobileToastService);

  readonly ofertas = signal<OfertaInsumoResponse[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  /** 403 means the documentary gate blocks the provider, not a network failure. */
  readonly validacionBloquea = signal(false);
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
        this.validacionBloquea.set(err instanceof ApiHttpError && err.status === 403);
        this.cargando.set(false);
      },
    });
  }

  aceptar(oferta: OfertaInsumoResponse): void {
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.aceptar(oferta.id).subscribe({
      next: (requerimiento) => {
        this.accionEnCurso.set(null);
        void this.toast.success(
          'Solicitud aceptada',
          `Estado del requerimiento: ${this.etiquetaRequerimiento(requerimiento.estado)}. Coordiná la entrega con el técnico.`,
        );
        this.cargar();
      },
      error: (err: Error) => {
        this.accionEnCurso.set(null);
        void this.toast.error('No se pudo aceptar', this.mensajeError(err, 'aceptar'));
      },
    });
  }

  rechazar(oferta: OfertaInsumoResponse): void {
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.rechazar(oferta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        void this.toast.info('Solicitud rechazada', 'No quedás vinculado a esta entrega.');
        this.cargar();
      },
      error: (err: Error) => {
        this.accionEnCurso.set(null);
        void this.toast.error('No se pudo rechazar', this.mensajeError(err, 'rechazar'));
      },
    });
  }

  entregar(oferta: OfertaInsumoResponse): void {
    const requerimientoId = oferta.requerimiento?.id;
    if (!requerimientoId) {
      void this.toast.error('Sin requerimiento', 'La oferta no expone el requerimiento a entregar.');
      return;
    }
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.entregar(requerimientoId).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        void this.toast.success('Entrega confirmada', 'El requerimiento quedó marcado como ENTREGADO.');
        this.cargar();
      },
      error: (err: Error) => {
        this.accionEnCurso.set(null);
        void this.toast.error('No se pudo confirmar la entrega', this.mensajeError(err, 'entregar'));
      },
    });
  }

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
          return mensajeErrorAccion(err);
      }
    }
    return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }

  etiquetaOferta(estado: OfertaInsumoEstado): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'ACEPTADA':
        return 'Aceptada';
      case 'RECHAZADO':
        return 'Rechazada';
      case 'EXPIRADA':
        return 'Expirada';
      case 'CANCELADA':
        return 'Cancelada';
    }
  }

  tonoOferta(estado: OfertaInsumoEstado): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'espera';
      case 'ACEPTADA':
        return 'ok';
      case 'RECHAZADO':
        return 'cerrada';
      default:
        return 'cerrada';
    }
  }

  etiquetaRequerimiento(estado: EstadoRequerimiento): string {
    switch (estado) {
      case 'SOLICITADO':
        return 'Solicitado';
      case 'ASIGNADO':
        return 'Asignado';
      case 'ENTREGADO':
        return 'Entregado';
      case 'SIN_PROVEEDOR':
        return 'Sin proveedor';
    }
  }
}
