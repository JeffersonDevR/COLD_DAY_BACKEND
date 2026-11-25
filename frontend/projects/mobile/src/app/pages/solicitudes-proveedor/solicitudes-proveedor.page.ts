import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
  ProveedorResponse,
} from '@core/models/common.models';
import { mensajeErrorGeolocation } from '@core/service/geolocation.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { MobileGeolocationService } from '../../core/geolocation-native';
import { MobileToastService } from '../../core/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/** Tope del ETA que el proveedor puede comprometer (el backend lo valida igual). */
const ETA_MAXIMO_MINUTOS = 240;

/** C1 — Provider portal: insumos requests with accept (with ETA) / reject / dispatch / deliver. */
@Component({
  selector: 'app-solicitudes-proveedor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    MarcaBarraComponent,
  ],
  templateUrl: './solicitudes-proveedor.page.html',
})
export class SolicitudesProveedorPage implements OnInit {
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly toast = inject(MobileToastService);
  private readonly geolocation = inject(MobileGeolocationService);

  readonly ofertas = signal<OfertaInsumoResponse[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  /** 403 means the documentary gate blocks the provider, not a network failure. */
  readonly validacionBloquea = signal(false);
  readonly accionEnCurso = signal<string | null>(null);

  /** Perfil propio: de ahí sale si ya fijó dónde opera. */
  readonly perfil = signal<ProveedorResponse | null>(null);
  readonly fijandoUbicacion = signal(false);
  /** Sin ubicación fijada no le llegan solicitudes: el aviso se reparte por radio. */
  readonly sinUbicacion = computed(() => {
    const perfil = this.perfil();
    return perfil !== null && (perfil.latitud == null || perfil.longitud == null);
  });

  /** Oferta que se está aceptando: el proveedor primero compromete sus minutos. */
  readonly ofertaAceptando = signal<string | null>(null);
  readonly etaTexto = signal('');
  readonly etaValido = computed(() => {
    const texto = this.etaTexto().trim();
    const minutos = Number(texto);
    return texto !== '' && Number.isInteger(minutos) && minutos >= 1 && minutos <= ETA_MAXIMO_MINUTOS;
  });

  /** Pendientes (por decidir) + aceptadas (por entregar): lo que se gestiona.
   Rechazadas/expiradas/canceladas ya están resueltas y no cuentan. */
  readonly solicitudesPorGestionar = computed(
    () =>
      this.ofertas().filter(
        (oferta) => oferta.estado === 'PENDIENTE' || oferta.estado === 'ACEPTADA',
      ).length,
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    // Solo alimenta el aviso de ubicación: si falla, la pantalla funciona igual.
    this.proveedoresApi.getMiPerfil().subscribe({
      next: (perfil) => this.perfil.set(perfil),
      error: () => this.perfil.set(null),
    });
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

  /** Pide el permiso del sistema (en nativo) y guarda la posición actual como lugar de operación. */
  fijarUbicacion(): void {
    if (this.fijandoUbicacion()) return;
    this.fijandoUbicacion.set(true);
    this.geolocation.obtenerPosicion().subscribe({
      next: (posicion) => {
        this.proveedoresApi.fijarMiUbicacion(posicion.latitud, posicion.longitud).subscribe({
          next: (perfil) => {
            this.fijandoUbicacion.set(false);
            this.perfil.set(perfil);
            void this.toast.success('Ubicación guardada', 'Ya te llegan las solicitudes cercanas a tu zona.');
          },
          error: (err: unknown) => {
            this.fijandoUbicacion.set(false);
            void this.toast.error('No pudimos guardar tu ubicación', mensajeErrorAccion(err));
          },
        });
      },
      error: (err: unknown) => {
        this.fijandoUbicacion.set(false);
        void this.toast.error('No pudimos obtener tu ubicación', mensajeErrorGeolocation(err));
      },
    });
  }

  /** Abre el compromiso de ETA, precargado con el que se sugiere por la distancia. */
  abrirAceptar(oferta: OfertaInsumoResponse): void {
    this.ofertaAceptando.set(oferta.id);
    this.etaTexto.set(oferta.etaSugeridoMinutos == null ? '' : String(oferta.etaSugeridoMinutos));
  }

  cancelarAceptar(): void {
    this.ofertaAceptando.set(null);
    this.etaTexto.set('');
  }

  onEta(evento: Event): void {
    this.etaTexto.set((evento.target as HTMLInputElement).value);
  }

  confirmarAceptar(oferta: OfertaInsumoResponse): void {
    if (!this.etaValido()) return;
    this.aceptar(oferta, Number(this.etaTexto()));
  }

  aceptar(oferta: OfertaInsumoResponse, etaMinutos: number): void {
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.aceptar(oferta.id, etaMinutos).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.cancelarAceptar();
        void this.toast.success(
          'Solicitud aceptada',
          `Quedaste comprometido a llegar en ${etaMinutos} min. Despacha el pedido cuando salga.`,
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
        void this.toast.info('Solicitud rechazada', 'No quedas vinculado a esta entrega.');
        this.cargar();
      },
      error: (err: Error) => {
        this.accionEnCurso.set(null);
        void this.toast.error('No se pudo rechazar', this.mensajeError(err, 'rechazar'));
      },
    });
  }

  despachar(oferta: OfertaInsumoResponse): void {
    const requerimientoId = oferta.requerimiento?.id;
    if (!requerimientoId) {
      void this.toast.error('Sin requerimiento', 'La oferta no expone el requerimiento a despachar.');
      return;
    }
    this.accionEnCurso.set(oferta.id);
    this.proveedoresApi.despachar(requerimientoId).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        void this.toast.success('Pedido despachado', 'El técnico ya sabe que tu pedido va en camino.');
        this.cargar();
      },
      error: (err: Error) => {
        this.accionEnCurso.set(null);
        void this.toast.error('No se pudo despachar', this.mensajeError(err, 'despachar'));
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

  private mensajeError(err: unknown, accion: 'aceptar' | 'rechazar' | 'despachar' | 'entregar'): string {
    if (err instanceof ApiHttpError) {
      switch (err.status) {
        case 400:
          return accion === 'aceptar'
            ? `Revisa el tiempo: debe estar entre 1 y ${ETA_MAXIMO_MINUTOS} minutos.`
            : mensajeErrorAccion(err);
        case 409:
          if (accion === 'aceptar') return 'Otra empresa tomó esta solicitud primero.';
          if (accion === 'despachar') return 'Este pedido ya fue despachado.';
          if (accion === 'entregar') return 'Despacha el pedido antes de confirmar la entrega.';
          return 'Esta solicitud ya fue gestionada por otro proveedor.';
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
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
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
      case 'DESPACHADO':
        return 'Despachado';
      case 'ENTREGADO':
        return 'Entregado';
      case 'SIN_PROVEEDOR':
        return 'Sin proveedor';
    }
  }
}
