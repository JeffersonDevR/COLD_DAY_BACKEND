import { ChangeDetectionStrategy, Component, DestroyRef, inject, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { pollVisibleTab } from '../../core/service/visible-tab-polling';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { OtResponse } from '../../core/models/common.models';
import { esErrorPerfilClienteFaltante } from '../../core/errorStatus/perfil-cliente';
import { recordarPanel } from '../../core/navihationError/panel-resolver';
import {
  FiltroOts,
  OPCIONES_FILTRO_OTS,
  TEXTOS_FILTRO_OTS,
  esOtActiva,
  esOtFinalizada,
  filtrarOts,
} from '../../core/service/ots-cliente';

// Se reexporta para conservar la API pública previa de la página.
export type { FiltroOts };

@Component({
  selector: 'app-panel-cliente-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, EstadoBadge, EmptyState],
  templateUrl: './panel-cliente-page.html'
})
export class PanelClientePage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);

  private readonly _ots = signal<OtResponse[]>([]);
  readonly serviciosCliente = computed(() => this._ots());

  /**
   * `GET /clientes/me/ots` responde 404 cuando la cuenta todavía no tiene
   * perfil de cliente (técnico dual-role recién llegado). No es una falla de
   * carga: la página ofrece crear el perfil.
   */
  readonly sinPerfilCliente = signal<boolean>(false);

  readonly serviciosActivos = computed(() => {
    return this.serviciosCliente().filter(esOtActiva);
  });

  readonly serviciosFinalizados = computed(() => {
    return this.serviciosCliente().filter(esOtFinalizada);
  });

  /** Vista elegida por el cliente; `ACTIVAS` mantiene el comportamiento de entrada. */
  readonly filtro = signal<FiltroOts>('ACTIVAS');

  /** Lista visible según el filtro. Los contadores de las métricas no dependen de ella. */
  readonly serviciosFiltrados = computed(() =>
    filtrarOts(this.serviciosCliente(), this.filtro()),
  );

  readonly opcionesFiltro = OPCIONES_FILTRO_OTS;

  readonly textosFiltro = TEXTOS_FILTRO_OTS;

  constructor() {
    // Último panel visitado: `/panel` y "Mi Panel" lo prefieren mientras los
    // roles del usuario sigan habilitándolo.
    recordarPanel('/cliente/panel');
    const currentId = String(this.authService.currentUser()?.id ?? '');
    this.cargarOts(currentId, true);
    // Refresco del listado: cada 25 s y solo con la pestaña visible.
    // `takeUntilDestroyed` corta el intervalo al destruirse la página.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarOts(currentId, false));
  }

  /**
   * `inicial` separa la carga de arranque del refresco periódico: si el primer
   * pedido falla conviene mostrar la lista vacía, pero un fallo transitorio del
   * refresco no debe borrar lo que el cliente ya está viendo.
   */
  private cargarOts(currentId: string, inicial: boolean): void {
    this.clientesApi.getOtsPorCliente(currentId).subscribe({
      next: (ots) => {
        this.sinPerfilCliente.set(false);
        this._ots.set(ots);
      },
      error: (err: unknown) => {
        if (esErrorPerfilClienteFaltante(err)) {
          this.sinPerfilCliente.set(true);
          this._ots.set([]);
          return;
        }
        if (inicial) this._ots.set([]);
      },
    });
  }

  irASolicitar(): void {
    // routerLink handles this
  }

  cambiarFiltro(filtro: FiltroOts): void {
    this.filtro.set(filtro);
  }
}
