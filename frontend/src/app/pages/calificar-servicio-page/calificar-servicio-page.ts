import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../core/service/ot-api';
import { cargarOtDesdeRuta, CargaOtEstado } from '../../core/service/ot-carga';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { OtResponse } from '../../core/models/common.models';

/**
 * Copy propia: el 409 del backend es `CalificacionInvalidaException` (orden no
 * FINALIZADA, ya calificada o sin técnico). Reintentar no cambia el resultado.
 */
const MENSAJES_CALIFICACION: Record<number, string> = {
  409: 'Esta orden todavía no se puede calificar: puede ser que aún no esté finalizada o que ya tengas una reseña registrada.',
};

@Component({
  selector: 'app-calificar-servicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './calificar-servicio-page.html'
})
export class CalificarServicioPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly toast = inject(ToastService);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  readonly ot = computed<OtResponse | undefined>(() => this._otRemoto());

  /** Estado de la carga: el fallo SIEMPRE se ve (con reintentar), nunca en blanco. */
  private cargaOtEstado: CargaOtEstado | null = null;

  /** Sin valor inicial: el cliente elige. Enviar sin elegir está bloqueado. */
  readonly estrellas = signal<number>(0);
  readonly tagsSeleccionados = signal<string[]>([]);
  readonly comentarioCtrl = new FormControl('');

  readonly tagsDisponibles = [
    'Puntualidad en llegada',
    'Limpieza del área',
    'Calidad técnica impecable',
    'Explicación clara del problema',
    'Uso de repuestos originales',
    'Trato respetuoso y honesto'
  ];

  ngOnInit(): void {
    this.cargaOtEstado = cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => this.otId.set(id),
      (orden) => this._otRemoto.set(orden),
    );
  }

  /** Copy del fallo de la carga de la OT (para el aviso con reintentar). */
  otErrorCarga(): string | null {
    return this.cargaOtEstado?.error() ?? null;
  }

  reintentarCargaOt(): void {
    this.cargaOtEstado?.reintentar();
  }

  toggleTag(tag: string): void {
    const list = this.tagsSeleccionados();
    if (list.includes(tag)) {
      this.tagsSeleccionados.set(list.filter(t => t !== tag));
    } else {
      this.tagsSeleccionados.set([...list, tag]);
    }
  }

  hasTag(tag: string): boolean {
    return this.tagsSeleccionados().includes(tag);
  }

  enviarCalificacion(): void {
    // Sin puntuación elegida no hay calificación que enviar.
    if (this.estrellas() === 0) return;

    const comentario = `${this.comentarioCtrl.value || ''} [Aspectos: ${this.tagsSeleccionados().join(', ')}]`;
    this.clientesApi.calificarServicio(this.otId(), this.estrellas(), comentario).subscribe({
      next: () => {
        this.toast.success('¡Gracias por tu opinión!', 'Tu reseña ha sido registrada y la reputación del técnico actualizada.');
        this.router.navigate(['/cliente/ot', this.otId()]);
      },
      error: (err: Error) => {
        avisarErrorAccion(this.toast, 'Calificación no disponible', err, MENSAJES_CALIFICACION);
      }
    });
  }
}
