import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonToolbar,
} from '@ionic/angular';
import { esErrorPerfilClienteFaltante } from '@core/errorStatus/perfil-cliente';
import { CategoriaServicio, EstadoOt, OtResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { ClientesApi } from '@core/service/clientes-api';
import { esOtActiva } from '@core/service/ots-cliente';
import { categoriaLabel } from '@core/ui/labels';
import { iconoCategoria as iconoDeCategoria } from '../../core/icono-categoria';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { PageComponent } from '../../shared/ui/page/page';
import { PriorityChipComponent } from '../../shared/ui/priority-chip/priority-chip.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * Historial del cliente (antes «Mis equipos»): una tarjeta por orden, de la más
 * reciente a la más antigua. La ruta sigue siendo `/cliente/equipos`.
 * Estructura: `docs/superpowers/specs/2026-11-27-observaciones-historial-recarga-design.md`.
 */
@Component({
  selector: 'app-mobile-equipos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    IonButton,
    IonCard,
    IonCardContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonToolbar,
    PageComponent,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    PriorityChipComponent,
    MarcaBarraComponent,
  ],
  template: `
    <cd-page>
      <ion-header class="cd-header" cdHeader>
        <ion-toolbar>
          <cd-marca pantalla="Historial" chip="Cliente" />
        </ion-toolbar>
      </ion-header>

      @if (cargando()) {
        <cd-skeleton label="Cargando tu historial" testId="equipos-cargando" />
      } @else if (sinPerfilCliente()) {
        <section class="cd-alerta cd-alerta--aviso" role="status" data-testid="equipos-sin-perfil">
          <h2 class="cd-alerta__titulo">Todavía no tienes perfil de cliente</h2>
          <p class="cd-alerta__texto">
            Necesitamos tus datos para guardar tus servicios. Los completas al pedir el primero.
          </p>
          <ion-button class="cd-cta" data-testid="equipos-crear-perfil" (click)="irASolicitar()">
            Pedir un servicio
          </ion-button>
        </section>
      } @else if (errorCarga()) {
        <cd-error-alert
          titulo="No pudimos cargar tu historial"
          texto="Revisa la conexión y vuelve a intentar. Tus órdenes siguen guardadas."
          testId="equipos-error"
          accionTestId="equipos-reintentar"
          (reintentar)="cargar()"
        />
      } @else if (!ordenes().length) {
        <cd-empty-state
          titulo="Aún no tienes servicios"
          texto="Cuando pidas un técnico, la orden queda guardada aquí."
          icono="file-tray-outline"
          testId="equipos-vacio"
        />
      } @else {
        @for (ot of ordenes(); track ot.id) {
          <ion-card class="cd-ot cd-ot--orden" data-testid="historial-ot">
            <ion-card-content>
              <div class="cd-historial__identidad">
                <span class="cd-equipo__icono" aria-hidden="true">
                  <ion-icon aria-hidden="true" [name]="iconoCategoria(ot.categoriaServicio)"></ion-icon>
                </span>
                <div class="cd-historial__titulos">
                  <h2 class="cd-ot__categoria">{{ categoria(ot) }}</h2>
                  @if (ot.codigo; as codigo) {
                    <span class="cd-ot__codigo">{{ codigo }}</span>
                  }
                </div>
              </div>
              <p class="cd-historial__chips">
                <span [class]="'cd-chip cd-chip--' + tono(ot.estado)">{{ etiqueta(ot.estado) }}</span>
                @if (activa(ot)) {
                  <app-priority-chip [prioridad]="ot.prioridad ?? 'MEDIA'" [conPalabra]="true" />
                }
              </p>
              <p class="cd-historial__falla">{{ ot.descripcionFalla }}</p>
              @if (ot.fechaCreacion || ot.barrio || ot.direccion) {
                <p class="cd-ot__pie">
                  <span>{{ ot.barrio || ot.direccion }}</span>
                  @if (ot.fechaCreacion; as fecha) {
                    <span class="cd-muted">{{ fecha | date: 'mediumDate' }}</span>
                  }
                </p>
              }
              <ion-button
                expand="block"
                class="cd-cta cd-cta--secundaria"
                fill="outline"
                data-testid="historial-revisar"
                (click)="abrir(ot)"
              >
                Revisar
              </ion-button>
            </ion-card-content>
          </ion-card>
        }
      }

      <ion-footer class="cd-footer" cdFooter>
        <ion-button
          expand="block"
          class="cd-cta"
          data-testid="equipos-solicitar"
          (click)="irASolicitar()"
        >
          <ion-icon slot="start" name="add-circle-outline" aria-hidden="true"></ion-icon>
          Pedir un técnico
        </ion-button>
      </ion-footer>
    </cd-page>
  `,
})
export class MobileEquiposPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clientesApi = inject(ClientesApi);
  private readonly router = inject(Router);

  private readonly ots = signal<OtResponse[]>([]);

  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);
  /** 404 de perfil de cliente faltante: se ofrece completarlo, no un error. */
  readonly sinPerfilCliente = signal<boolean>(false);

  /** De la más reciente a la más antigua; sin fecha, al final. */
  readonly ordenes = computed(() =>
    [...this.ots()].sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? '')),
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.sinPerfilCliente.set(false);
    this.clientesApi.getOtsPorCliente(String(this.authService.currentUser()?.id ?? '')).subscribe({
      next: (ots) => {
        this.ots.set(ots);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.ots.set([]);
        this.cargando.set(false);
        if (esErrorPerfilClienteFaltante(err)) {
          this.sinPerfilCliente.set(true);
          return;
        }
        this.errorCarga.set(true);
      },
    });
  }

  categoria(ot: OtResponse): string {
    return categoriaLabel(ot.categoriaServicio);
  }

  activa(ot: OtResponse): boolean {
    return esOtActiva(ot);
  }

  etiqueta(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado] ?? estado;
  }

  tono(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }

  /** Icono decorativo por categoría; el contenedor va con aria-hidden. */
  iconoCategoria(categoria: CategoriaServicio): string {
    return iconoDeCategoria(categoria);
  }

  abrir(ot: OtResponse): void {
    void this.router.navigate(['/cliente/ot', ot.id]);
  }

  irASolicitar(): void {
    void this.router.navigate(['/cliente/solicitar']);
  }
}
