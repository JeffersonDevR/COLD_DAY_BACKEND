import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../modules/ot/infrastructure/ot-api';
import { cargarOtDesdeRuta } from '../../modules/ot/infrastructure/ot-carga';
import { ToastService } from '../../core/alertas/toast.service';
import { OtResponse } from '../../core/models/common.models';

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

  readonly estrellas = signal<number>(5);
  readonly tagsSeleccionados = signal<string[]>(['Puntualidad en llegada', 'Limpieza del área']);
  readonly comentarioCtrl = new FormControl('Excelente trabajo, dejó el aire enfriando a 16°C y limpió el desagüe.');

  readonly tagsDisponibles = [
    'Puntualidad en llegada',
    'Limpieza del área',
    'Calidad técnica impecable',
    'Explicación clara del problema',
    'Uso de repuestos originales',
    'Trato respetuoso y honesto'
  ];

  ngOnInit(): void {
    cargarOtDesdeRuta(this.route, this.otApi, (id) => this.otId.set(id), (orden) => this._otRemoto.set(orden));
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
    const comentario = `${this.comentarioCtrl.value || ''} [Aspectos: ${this.tagsSeleccionados().join(', ')}]`;
    this.clientesApi.calificarServicio(this.otId(), this.estrellas(), comentario).subscribe({
      next: () => {
        this.toast.success('¡Gracias por tu opinión!', 'Tu reseña ha sido registrada y la reputación del técnico actualizada.');
        this.router.navigate(['/cliente/ot', this.otId()]);
      },
      error: (err: Error) => {
        this.toast.error('Calificación no disponible', err.message);
      }
    });
  }
}
