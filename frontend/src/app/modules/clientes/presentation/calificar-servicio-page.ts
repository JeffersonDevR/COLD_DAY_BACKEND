import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-calificar-servicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, ReactiveFormsModule],
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-xl mx-auto">
        <div>
          <a [routerLink]="['/cliente/ot', orden.id]" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <mat-icon class="text-xs">arrow_back</mat-icon> Volver al Seguimiento
          </a>
          <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100">
            Calificar Servicio Técnico
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Tu opinión recalcula la reputación pública del técnico en Cúcuta
          </p>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <!-- Info del Técnico -->
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <div class="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold text-lg">
              {{ orden.tecnicoNombre?.charAt(0) || 'T' }}
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ orden.tecnicoNombre }}</h3>
              <p class="text-xs text-slate-500">Servicio de {{ orden.categoriaServicio.replace('_', ' ') }} • OT {{ orden.id }}</p>
            </div>
          </div>

          <!-- Selector de Estrellas (1 a 5) -->
          <div class="text-center space-y-2">
            <span class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Puntuación General (1 a 5)
            </span>
            <div class="flex items-center justify-center gap-2">
              @for (star of [1, 2, 3, 4, 5]; track star) {
                <button
                  type="button"
                  (click)="estrellas.set(star)"
                  class="p-2 transition-transform hover:scale-110 focus:outline-none"
                >
                  <mat-icon
                    class="text-3xl"
                    [class.text-amber-400]="star <= estrellas()"
                    [class.text-slate-200]="star > estrellas()"
                    [class.dark:text-slate-700]="star > estrellas()"
                  >
                    star
                  </mat-icon>
                </button>
              }
            </div>
            <span class="text-xs font-bold text-amber-500 block">
              @switch (estrellas()) {
                @case (5) { ¡Excelente servicio impecable! }
                @case (4) { Muy buen trabajo técnico }
                @case (3) { Aceptable, con aspectos por mejorar }
                @case (2) { Regular, inconforme con el resultado }
                @case (1) { Pésima experiencia }
              }
            </span>
          </div>

          <!-- Aspectos Destacados -->
          <div class="space-y-2">
            <span class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aspectos Destacados
            </span>
            <div class="flex flex-wrap gap-2">
              @for (tag of tagsDisponibles; track tag) {
                <button
                  type="button"
                  (click)="toggleTag(tag)"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                  [class.bg-sky-50]="hasTag(tag)"
                  [class.dark:bg-sky-950/50]="hasTag(tag)"
                  [class.text-sky-700]="hasTag(tag)"
                  [class.dark:text-sky-300]="hasTag(tag)"
                  [class.border-sky-500]="hasTag(tag)"
                  [class.border-slate-200]="!hasTag(tag)"
                  [class.dark:border-slate-700]="!hasTag(tag)"
                  [class.text-slate-600]="!hasTag(tag)"
                  [class.dark:text-slate-400]="!hasTag(tag)"
                >
                  {{ tag }}
                </button>
              }
            </div>
          </div>

          <!-- Comentario Abierto -->
          <div>
            <label for="comentarioCtrl" class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Comentario del Servicio (Opcional)
            </label>
            <textarea
              id="comentarioCtrl"
              rows="3"
              [formControl]="comentarioCtrl"
              placeholder="Comparte detalles de la puntualidad, limpieza, trato y efectividad en la reparación..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
            ></textarea>
          </div>

          <!-- Botón de Envío -->
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="enviarCalificacion()"
              class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-colors inline-flex items-center gap-2"
            >
              <mat-icon class="text-sm">send</mat-icon>
              Guardar Calificación
            </button>
          </div>
        </div>
      </div>
    }
  `
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
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.otId.set(id);
        this.otApi.getOtById(id).subscribe({
          next: (orden) => this._otRemoto.set(orden),
        });
      }
    });
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
