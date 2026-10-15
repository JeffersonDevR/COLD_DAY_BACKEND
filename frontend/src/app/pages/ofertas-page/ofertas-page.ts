import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { ToastService } from '../../core/alertas/toast.service';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

@Component({
  selector: 'app-ofertas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './ofertas-page.html',
})
export class OfertasPage {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadingOt = signal<string | null>(null);
  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly ofertas = signal<OfertaTecnicoResponse[]>([]);

  /** Cargo de visita + diagnóstico que verá el cliente al aceptar. */
  readonly auxiliaresMax = environment.auxiliaresMax;

  /** Conteo de auxiliares por OT; 0 por defecto para aceptar sin fricción. */
  private readonly auxiliaresPorOt = signal<Record<string, number>>({});

  readonly solicitudesDisponibles = computed(() => this.ofertas().map(oferta => oferta.ot));

  constructor() {
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        this.tecnico.set(tecnico);
        if (tecnico) {
          this.cargarOfertas(tecnico.id);
        }
      },
      () => this.toast.error('Error', 'No se pudo cargar tu perfil de técnico.'),
    );
    // Refresco del radar: cada 25 s y solo con la pestaña visible. Es silencioso
    // para no repetir el aviso de error en cada vuelta.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recargarOfertas(true));
  }

  private cargarOfertas(tecnicoId: string, inicial = true): void {
    this.tecnicosApi.getOfertasParaTecnico(tecnicoId).subscribe({
      next: (ofertas) => this.ofertas.set(ofertas),
      error: () => {
        if (inicial) this.toast.error('Error de Conexión', 'No se pudieron consultar las ofertas disponibles.');
      },
    });
  }

  /** `silencioso` lo usa el refresco periódico; el botón manual sí avisa del fallo. */
  recargarOfertas(silencioso = false): void {
    const tecnico = this.tecnico();
    if (tecnico) {
      this.cargarOfertas(tecnico.id, !silencioso);
    }
  }

  /** Auxiliares declarados para una OT; 0 cuando el técnico no toca el campo. */
  auxiliaresDe(otId: string): number {
    return this.auxiliaresPorOt()[otId] ?? 0;
  }

  setAuxiliares(otId: string, raw: string): void {
    const valor = raw === '' ? 0 : Number(raw);
    this.auxiliaresPorOt.update((mapa) => ({ ...mapa, [otId]: Number.isFinite(valor) ? valor : 0 }));
  }

  aceptarOferta(ot: OtResponse): void {
    const tecnico = this.tecnico();
    if (!tecnico) {
      this.toast.error('Error', 'No se encontró el perfil de técnico.');
      return;
    }

    if (tecnico.estadoOperativo === 'BLOQUEADO_POR_LIQUIDACION') {
      this.toast.error('Operación Bloqueada', 'Debes legalizar tus liquidaciones pendientes para tomar servicios.');
      return;
    }

    const auxiliaresRequeridos = this.auxiliaresDe(ot.id);
    if (
      !Number.isInteger(auxiliaresRequeridos) ||
      auxiliaresRequeridos < 0 ||
      auxiliaresRequeridos > this.auxiliaresMax
    ) {
      this.toast.error(
        'Auxiliares inválidos',
        `Indica un número entero entre 0 y ${this.auxiliaresMax}. Usa 0 si no necesitas ayudantes.`
      );
      return;
    }

    const oferta = this.ofertas().find(o => o.otId === ot.id);
    if (!oferta) {
      this.toast.error('Sin Oferta Vigente', `No hay una oferta activa para la orden ${ot.codigo || 'Sin código'}. Puede que ya haya sido tomada.`);
      return;
    }

    this.loadingOt.set(ot.id);
    this.tecnicosApi.aceptarOferta(oferta.id, tecnico.id, auxiliaresRequeridos).subscribe({
      next: () => {
        this.loadingOt.set(null);
        const detalleAuxiliares =
          auxiliaresRequeridos > 0 ? ` con ${auxiliaresRequeridos} auxiliar(es)` : '';
        this.toast.success(
          '¡Servicio Asignado!',
          `Has tomado la orden ${ot.codigo || 'Sin código'}${detalleAuxiliares}. Se notificó al cliente la tarifa de visita + diagnóstico por distancia. Desplázate al domicilio.`
        );
        this.router.navigate(['/tecnico/ejecucion', ot.id]);
      },
      error: () => {
        this.loadingOt.set(null);
        this.toast.error('Error de Concurrencia', 'Esta orden ya fue tomada por otro técnico en el perímetro.');
      }
    });
  }
}
