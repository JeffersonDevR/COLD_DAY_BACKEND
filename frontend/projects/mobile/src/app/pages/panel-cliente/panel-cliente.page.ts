import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
  RefresherCustomEvent,
  SegmentCustomEvent,
} from '@ionic/angular';
import { mensajeErrorAccion, sesionYaNotificada } from '@core/alertas/mensaje-error';
import { esErrorPerfilClienteFaltante } from '@core/errorStatus/perfil-cliente';
import { EstadoOt, OtResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { ClientesApi } from '@core/service/clientes-api';
import {
  FiltroOts,
  OPCIONES_FILTRO_OTS,
  TEXTOS_FILTRO_OTS,
  contarOtsActivas,
  contarOtsFinalizadas,
  filtrarOts,
} from '@core/service/ots-cliente';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { PriorityChipComponent } from '../../shared/ui/priority-chip/priority-chip.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * A4 — Panel del cliente.
 *
 * Es la misma lista de OTs de la web, con los mismos filtros y contadores de
 * `@core/service/ots-cliente`, pero con dos correcciones deliberadas:
 *
 * - Un fallo de carga inicial muestra un estado de error con "Reintentar"; la
 *   web lo escondía tras un listado vacío (mentía sobre la causa).
 * - El refresco periódico (25 s, solo con la app visible) nunca borra la lista
 *   que el cliente ya está viendo.
 */
@Component({
  selector: 'app-mobile-panel-cliente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonToolbar,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    PriorityChipComponent,
  ],
  template: `
    <ion-header class="cd-header">
      <ion-toolbar>
        <div class="cd-panel__barra">
          <div class="cd-panel__identidad">
            <span class="cd-panel__logo" aria-hidden="true">
              <ion-icon name="snow-outline"></ion-icon>
            </span>
            <div>
              <p class="cd-panel__marca">Cold Day · Ops</p>
              <p class="cd-panel__rol">Panel de operaciones</p>
            </div>
          </div>
          <span class="cd-chip cd-chip--activo">Cliente</span>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding cd-panel-content">
      <ion-refresher slot="fixed" (ionRefresh)="refrescar($event)">
        <ion-refresher-content
          pullingText="Desliza para actualizar"
          refreshingSpinner="dots"
          refreshingText="Actualizando..."
        ></ion-refresher-content>
      </ion-refresher>

      <div class="cd-hero">
      <h1 class="cd-headline" data-testid="panel-saludo">Hola, {{ nombre() }}</h1>
      <p class="cd-hero__nota">
        Pide un servicio y tu solicitud sale a los técnicos cercanos de Cúcuta: el primero
        que la acepta toma la orden. Seguimiento en vivo y acta formal de garantía.
      </p>
      <div class="cd-hero__acciones">
        <ion-button
          size="small"
          fill="outline"
          color="primary"
          class="cd-accion"
          data-testid="panel-equipos"
          (click)="verHistorial()"
        >
          <ion-icon slot="start" name="time-outline" aria-hidden="true"></ion-icon>
          Historial
        </ion-button>
      </div>
      </div>

      @if (cargando()) {
        <cd-skeleton label="Cargando tus servicios" testId="panel-cargando" />
      } @else if (errorCarga(); as mensaje) {
        <cd-error-alert
          titulo="No pudimos cargar tus servicios"
          [texto]="mensaje"
          testId="panel-error"
          accionTestId="panel-reintentar"
          (reintentar)="reintentar()"
        />
      } @else if (sinPerfilCliente()) {
        <section class="cd-alerta cd-alerta--aviso" role="status" data-testid="panel-sin-perfil">
          <h2 class="cd-alerta__titulo">Todavía no tienes perfil de cliente</h2>
          <p class="cd-alerta__texto">
            Tu cuenta puede pedir servicios, pero nos faltan tus datos de cliente. Los completas
            en el mismo formulario de la solicitud con la dirección y la ubicación que ya vas a
            cargar ahí: al confirmar, el perfil se crea y la orden sale en el mismo paso.
          </p>
          <ion-button
            class="cd-cta"
            data-testid="panel-crear-perfil"
            (click)="pedirTecnico()"
          >
            Crear mi perfil en la solicitud
          </ion-button>
        </section>
      } @else {
        <p class="cd-panel__resumen" aria-label="Resumen de tus servicios">
          <span><b data-testid="panel-total-activas">{{ activas() }}</b> en proceso</span>
          <span><b data-testid="panel-total-finalizadas">{{ finalizadas() }}</b> {{ finalizadas() === 1 ? 'concluido' : 'concluidos' }}</span>
          <span><b data-testid="panel-total-sin-tecnico">{{ sinTecnico() }}</b> sin técnico</span>
        </p>

        <ion-segment
          class="cd-filtros cd-filtros--cliente"
          [value]="filtro()"
          aria-label="Filtrar órdenes de trabajo por estado"
          data-testid="panel-filtros"
          (ionChange)="cambiarFiltro($event)"
        >
          @for (opcion of opciones; track opcion.valor) {
            <ion-segment-button [value]="opcion.valor" [attr.data-testid]="'panel-filtro-' + opcion.valor">
              <ion-label>{{ opcion.etiqueta }}</ion-label>
            </ion-segment-button>
          }
        </ion-segment>

        <p class="cd-muted cd-panel__sub" data-testid="panel-subtitulo">{{ textos().subtitulo }}</p>

        <!-- A10 no es un tab: se abre desde acá y se vuelve al panel. -->
        <ion-button
          expand="block"
          fill="clear"
          class="cd-accion cd-panel__equipos"
          data-testid="panel-mis-equipos"
          (click)="irAMisEquipos()"
        >
          <ion-icon slot="start" name="cube-outline" aria-hidden="true"></ion-icon>
          Mis órdenes
        </ion-button>

        @if (serviciosFiltrados().length === 0) {
          <cd-empty-state
            [titulo]="textos().tituloVacio"
            [texto]="textos().descripcionVacio"
            icono="file-tray-outline"
            testId="panel-vacio"
          />
        } @else {
          @for (ot of serviciosFiltrados(); track ot.id) {
            <ion-card class="cd-ot cd-panel-ot cd-ot--orden" data-testid="panel-ot">
              <ion-card-content>
                <div class="cd-ot__cabecera">
                  <div class="cd-ot__titulos">
                    <span class="cd-ot__codigo" data-testid="panel-ot-codigo">
                      {{ ot.codigo || 'Sin código' }}
                    </span>
                    <h2 class="cd-ot__categoria">{{ categoria(ot) }}</h2>
                  </div>
                  <app-priority-chip
                    class="cd-ot__prioridad"
                    [prioridad]="ot.prioridad ?? 'MEDIA'"
                  />
                  <span [class]="'cd-chip cd-chip--' + tono(ot.estado)">{{ etiqueta(ot.estado) }}</span>
                </div>
                <p class="cd-ot__descripcion">{{ ot.descripcionFalla }}</p>
                <div class="cd-ot__pie">
                  <span class="cd-ot__direccion">
                    <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
                    {{ ot.barrio || ot.direccion || 'Sin dirección' }}
                  </span>
                  @if (ot.fechaCreacion; as fecha) {
                    <span class="cd-muted">{{ fecha | date: 'shortTime' }}</span>
                  }
                </div>
                <div class="cd-ot__acciones">
                  <ion-button
                    size="small"
                    fill="clear"
                    class="cd-accion"
                    data-testid="panel-ot-ver"
                    (click)="verSeguimiento(ot.id)"
                  >
                    Ver seguimiento
                    <ion-icon slot="end" name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          }
        }
      }
    </ion-content>

    <ion-footer class="cd-footer">
      <ion-button
        expand="block"
        class="cd-cta"
        data-testid="panel-solicitar"
        (click)="pedirTecnico()"
      >
        <ion-icon slot="start" name="add-circle-outline" aria-hidden="true"></ion-icon>
        Pedir un técnico
      </ion-button>
    </ion-footer>
  `,
})
export class PanelClientePage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly ots = signal<OtResponse[]>([]);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  /**
   * `GET /clientes/me/ots` responde 404 cuando la cuenta todavía no tiene
   * perfil de cliente (técnico dual-role recién llegado). No es una falla de
   * carga: se ofrece el alta dentro de la solicitud.
   */
  protected readonly sinPerfilCliente = signal(false);

  protected readonly filtro = signal<FiltroOts>('ACTIVAS');

  protected readonly opciones = OPCIONES_FILTRO_OTS;
  protected readonly textos = computed(() => TEXTOS_FILTRO_OTS[this.filtro()]);

  protected readonly serviciosFiltrados = computed(() => filtrarOts(this.ots(), this.filtro()));

  /** Contadores de las métricas: resumen de TODA la lista, no de la vista. */
  protected readonly activas = computed(() => contarOtsActivas(this.ots()));
  protected readonly finalizadas = computed(() => contarOtsFinalizadas(this.ots()));

  /** Órdenes abiertas sin técnico asignado (la métrica amber de Stitch). */
  protected readonly sinTecnico = computed(
    () => this.ots().filter((o) => !o.tecnicoId && o.estado !== 'CANCELADA').length,
  );

  /** El JWT real no emite `nombre`: una sesión sin nombre se saluda por su rol. */
  protected readonly nombre = computed(() => this.auth.currentUser()?.nombre || 'Cliente');

  constructor() {
    this.cargar({ inicial: true });
    // Refresco cada 25 s y solo con la app visible. En el WebView,
    // `visibilitychange` se dispara cuando la app pasa a segundo plano.
    pollVisibleTab()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());
  }

  protected etiqueta(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado];
  }

  protected tono(estado: EstadoOt): 'ok' | 'curso' | 'espera' | 'cerrada' {
    return tonoEstadoOt(estado);
  }

  /** La categoría viene como enum del backend: se muestra legible, sin guiones bajos. */
  protected categoria(ot: OtResponse): string {
    return ot.categoriaServicio.replaceAll('_', ' ');
  }

  /** A10 — Mis órdenes. Pantalla secundaria: se llega desde el panel. */
  protected irAMisEquipos(): void {
    void this.router.navigateByUrl('/cliente/equipos');
  }

  protected cambiarFiltro(evento: SegmentCustomEvent): void {
    const valor = evento.detail.value;
    if (valor) this.filtro.set(valor as FiltroOts);
  }

  protected reintentar(): void {
    this.cargar({ inicial: true });
  }

  protected refrescar(evento: RefresherCustomEvent): void {
    this.cargar({ manual: true, alTerminar: () => void evento.target.complete() });
  }

  protected pedirTecnico(): void {
    void this.router.navigateByUrl('/cliente/solicitar');
  }

  /**
   * "Historial" filtra las órdenes concluidas. Antes navegaba a `/cliente/equipos`,
   * el mismo destino que "Mis órdenes" en la misma pantalla (DESIGN §4: un botón,
   * una ruta).
   */
  protected verHistorial(): void {
    this.filtro.set('COMPLETADAS');
  }

  /** A6: cada OT del listado abre su seguimiento. */
  protected verSeguimiento(id: string): void {
    void this.router.navigateByUrl(`/cliente/ot/${id}`);
  }

  /**
   * Carga o refresca el listado.
   *
   * `inicial` separa el arranque del refresco: un fallo de arranque deja la
   * pantalla en error con reintento, pero un fallo transitorio del refresco no
   * puede borrar lo que el cliente ya está viendo.
   */
  private cargar(
    opciones: { inicial?: boolean; manual?: boolean; alTerminar?: () => void } = {},
  ): void {
    const { inicial = false, manual = false, alTerminar } = opciones;
    if (inicial) {
      this.cargando.set(true);
      this.errorCarga.set(null);
    }

    const idCliente = String(this.auth.currentUser()?.id ?? '');
    this.clientesApi.getOtsPorCliente(idCliente).subscribe({
      next: (ots) => {
        this.cargando.set(false);
        this.errorCarga.set(null);
        this.sinPerfilCliente.set(false);
        this.ots.set(ots);
        alTerminar?.();
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        alTerminar?.();

        // El interceptor ya avisó (y cerró sesión): la pantalla no repite nada.
        if (sesionYaNotificada(err)) return;

        if (esErrorPerfilClienteFaltante(err)) {
          this.sinPerfilCliente.set(true);
          this.ots.set([]);
          return;
        }

        if (!inicial) {
          // Refresco fallido sobre datos ya cargados: se conserva la lista. El
          // deslizamiento manual sí avisa, porque lo pidió el usuario.
          if (manual) {
            void this.toast.error('No pudimos actualizar', mensajeErrorAccion(err));
          }
          return;
        }

        this.errorCarga.set(mensajeErrorAccion(err));
        this.ots.set([]);
      },
    });
  }
}
