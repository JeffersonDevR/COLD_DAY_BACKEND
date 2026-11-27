import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { mensajeErrorAccion, sesionYaNotificada } from '@core/alertas/mensaje-error';
import { esErrorPerfilClienteFaltante } from '@core/errorStatus/perfil-cliente';
import { EstadoOt, OtResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { ClientesApi } from '@core/service/clientes-api';
import { esOtActiva } from '@core/service/ots-cliente';
import { pollVisibleTab } from '@core/service/visible-tab-polling';
import { MobileToastService } from '../../core/toast.service';
import { accionOtCliente, tituloEstadoOt } from '../../shared/orden-reglas';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { OrdenActivaComponent } from '../../shared/ui/orden-activa/orden-activa';
import { PageComponent } from '../../shared/ui/page/page';
import { PriorityChipComponent } from '../../shared/ui/priority-chip/priority-chip.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * A4 — Panel del cliente.
 *
 * La orden activa domina la pantalla (`cd-orden-activa`); las demás activas van
 * compactas y las cerradas en un historial plegado. Estructura:
 * `docs/superpowers/specs/2026-11-27-rediseno-paneles-design.md`.
 *
 * Dos correcciones deliberadas frente a la web:
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
    NgTemplateOutlet,
    IonButton,
    IonFooter,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonToolbar,
    PageComponent,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    PriorityChipComponent,
    MarcaBarraComponent,
    OrdenActivaComponent,
  ],
  template: `
    <cd-page
      [titulo]="'Hola, ' + nombre()"
      tituloTestId="panel-saludo"
      contenidoClase="cd-panel-content"
    >
      <ion-header class="cd-header" cdHeader>
        <ion-toolbar>
          <cd-marca pantalla="Panel de operaciones" chip="Cliente" />
        </ion-toolbar>
      </ion-header>

      <ion-refresher slot="fixed" (ionRefresh)="refrescar($event)">
        <ion-refresher-content
          pullingText="Desliza para actualizar"
          refreshingSpinner="dots"
          refreshingText="Actualizando..."
        ></ion-refresher-content>
      </ion-refresher>

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
        @if (activa(); as orden) {
          <cd-orden-activa
            [estado]="titulo(orden)"
            [categoria]="categoria(orden)"
            [codigo]="orden.codigo"
            [prioridad]="orden.prioridad ?? 'MEDIA'"
            [contexto]="orden.tecnicoNombre ? [orden.tecnicoNombre] : []"
            [direccion]="orden.direccion || orden.barrio"
            [accion]="textoAccion(orden)"
            (accionar)="atender(orden)"
          />
        } @else if (historial().length === 0) {
          <cd-empty-state
            titulo="Aún no tienes servicios"
            texto="Pide un técnico y aquí verás en qué va."
            icono="file-tray-outline"
            testId="panel-vacio"
          />
        }

        @if (otras().length > 0) {
          <h2 class="cd-section__titulo cd-section__titulo--bloque">Otras órdenes</h2>
          @for (orden of otras(); track orden.id) {
            <ng-container
              *ngTemplateOutlet="compacta; context: { $implicit: orden, testId: 'panel-ot' }"
            />
          }
        }

        @if (historial().length > 0) {
          <button
            type="button"
            class="cd-desplegable__cabecera"
            [attr.aria-expanded]="historialAbierto()"
            aria-controls="panel-historial-contenido"
            data-testid="panel-historial"
            (click)="alternarHistorial()"
          >
            <span class="cd-card__titulo">Historial ({{ historial().length }})</span>
            <ion-icon
              [name]="historialAbierto() ? 'chevron-up-outline' : 'chevron-down-outline'"
              aria-hidden="true"
            ></ion-icon>
          </button>
          <div
            id="panel-historial-contenido"
            class="cd-desplegable__contenido"
            [hidden]="!historialAbierto()"
            data-testid="panel-historial-contenido"
          >
            @for (orden of historial(); track orden.id) {
              <ng-container
                *ngTemplateOutlet="
                  compacta;
                  context: { $implicit: orden, testId: 'panel-historial-ot' }
                "
              />
            }
          </div>
        }
      }

      <ng-template #compacta let-orden let-testId="testId">
        <button
          type="button"
          class="cd-ot cd-ot--compacta"
          [attr.data-testid]="testId"
          (click)="verSeguimiento(orden.id)"
        >
          <span class="cd-ot__cabecera">
            <span>
              <span class="cd-ot__codigo">{{ orden.codigo || 'Sin código' }}</span>
              <span class="cd-ot__categoria">{{ categoria(orden) }}</span>
            </span>
            <app-priority-chip [prioridad]="orden.prioridad ?? 'MEDIA'" />
            <span [class]="'cd-chip cd-chip--' + tono(orden.estado)">{{ etiqueta(orden.estado) }}</span>
          </span>
          <span class="cd-ot__direccion">
            <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
            {{ orden.barrio || orden.direccion || 'Sin dirección' }}
          </span>
        </button>
      </ng-template>

      <ion-footer class="cd-footer" cdFooter>
        <ion-button
          expand="block"
          class="cd-cta"
          data-testid="panel-solicitar"
          [fill]="activa() ? 'outline' : 'solid'"
          [class.cd-cta--secundaria]="!!activa()"
          (click)="pedirTecnico()"
        >
          <ion-icon slot="start" name="add-circle-outline" aria-hidden="true"></ion-icon>
          Pedir un técnico
        </ion-button>
      </ion-footer>
    </cd-page>
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

  /** Activas, de la más reciente a la más antigua; sin fecha, al final. */
  private readonly activas = computed(() =>
    this.ots()
      .filter(esOtActiva)
      .sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? '')),
  );

  /** La grande: la que espera algo del cliente y, si ninguna, la más reciente. */
  protected readonly activa = computed<OtResponse | null>(() => {
    const activas = this.activas();
    const pide = (accion: string) => activas.find((ot) => this.accionDelPanel(ot) === accion);
    return pide('pagar-visita') ?? pide('presupuesto') ?? activas[0] ?? null;
  });

  protected readonly otras = computed(() => this.activas().filter((ot) => ot !== this.activa()));
  protected readonly historial = computed(() => this.ots().filter((ot) => !esOtActiva(ot)));
  protected readonly historialAbierto = signal(false);

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

  protected titulo(ot: OtResponse): string {
    return tituloEstadoOt(ot);
  }

  protected textoAccion(ot: OtResponse): string {
    const accion = this.accionDelPanel(ot);
    if (accion === 'pagar-visita') return 'Pagar la visita';
    return accion === 'presupuesto' ? 'Revisar presupuesto' : 'Ver seguimiento';
  }

  /** El pago vive en Seguimiento; el presupuesto, en el diagnóstico. */
  protected atender(ot: OtResponse): void {
    const sufijo = this.accionDelPanel(ot) === 'presupuesto' ? '/diagnostico' : '';
    void this.router.navigateByUrl(`/cliente/ot/${ot.id}${sufijo}`);
  }

  protected alternarHistorial(): void {
    this.historialAbierto.update((abierto) => !abierto);
  }

  /** Una disputa se sigue en Seguimiento: desde el panel no se invita a pagar. */
  private accionDelPanel(ot: OtResponse) {
    return ot.estado === 'DISPUTADA' ? null : accionOtCliente(ot);
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
