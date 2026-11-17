import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { esErrorPerfilClienteFaltante } from '@core/errorStatus/perfil-cliente';
import { EstadoOt, OtResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { ClientesApi } from '@core/service/clientes-api';
import { EquipoCliente, agruparEquipos } from '@core/service/equipos-cliente';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { PriorityChipComponent } from '../../shared/ui/priority-chip/priority-chip.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * A10 — Mis órdenes (cliente).
 *
 * El agrupado vive en `@core/service/equipos-cliente` (compartido con la web);
 * acá sólo queda la presentación y lo que esta plataforma decide: la
 * iconografía.
 *
 * Se llega por el tab `equipos` del cliente y además desde el panel: el
 * historial por equipo es de las pocas cosas que el cliente busca solo.
 *
 * Se diferencia de la web en que un fallo de carga se puede reintentar en vez
 * de mostrar una lista vacía que miente sobre la causa.
 */
@Component({
  selector: 'app-mobile-equipos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    SkeletonComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    PriorityChipComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Mis órdenes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (cargando()) {
        <cd-skeleton label="Cargando tus equipos" testId="equipos-cargando" />
      } @else if (sinPerfilCliente()) {
        <section class="cd-alerta cd-alerta--aviso" role="status" data-testid="equipos-sin-perfil">
          <h2 class="cd-alerta__titulo">Todavía no tienes perfil de cliente</h2>
          <p class="cd-alerta__texto">
            Necesitamos tus datos para asociar los equipos a tu cuenta. Los completas al pedir tu
            primer servicio.
          </p>
          <ion-button class="cd-cta" data-testid="equipos-crear-perfil" (click)="irASolicitar()">
            Pedir un servicio
          </ion-button>
        </section>
      } @else if (errorCarga()) {
        <cd-error-alert
          titulo="No pudimos cargar tus equipos"
          texto="Revisa la conexión y vuelve a intentar. Tus órdenes siguen guardadas."
          testId="equipos-error"
          accionTestId="equipos-reintentar"
          (reintentar)="cargar()"
        />
      } @else if (!equipos().length) {
        <cd-empty-state
          titulo="Todavía no tienes equipos"
          texto="Cuando pidas un servicio, el equipo queda registrado con su historial."
          icono="cube-outline"
          testId="equipos-vacio"
        />
      } @else {
        <p class="cd-eyebrow">{{ equipos().length }} equipos · historial completo</p>

        @for (equipo of equipos(); track equipo.categoria) {
          <ion-card class="cd-ot cd-ot--orden" data-testid="equipo">
            <ion-card-content>
              <div class="cd-ot__cabecera">
                <div class="cd-ot__titulos">
                  <span class="cd-ot__codigo">{{ equipo.codigoOt }}</span>
                  <h2 class="cd-ot__categoria">{{ equipo.etiqueta }}</h2>
                </div>
                <app-priority-chip
                  class="cd-ot__prioridad"
                  [prioridad]="equipo.prioridad ?? 'MEDIA'"
                />
                <span [class]="'cd-chip cd-chip--' + tono(equipo.estado)">
                  {{ etiqueta(equipo.estado) }}
                </span>
              </div>
              <div class="cd-ot__pie">
                <span>
                  {{ equipo.intervenciones }}
                  {{ equipo.intervenciones === 1 ? 'servicio' : 'servicios' }}
                </span>
                <span class="cd-muted">{{ equipo.fecha }}</span>
              </div>
              <div class="cd-ot__acciones">
                <ion-button
                  class="cd-cta"
                  fill="outline"
                  data-testid="equipo-ver"
                  (click)="abrir(equipo)"
                >
                  Ver la última OT
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>

    <ion-footer class="cd-footer">
      <ion-button
        expand="block"
        class="cd-cta"
        data-testid="equipos-solicitar"
        (click)="irASolicitar()"
      >
        <ion-icon slot="start" name="add-circle-outline" aria-hidden="true"></ion-icon>
        Registrar otro equipo
      </ion-button>
    </ion-footer>
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

  readonly equipos = computed<EquipoCliente[]>(() => agruparEquipos(this.ots()));

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

  etiqueta(estado: EstadoOt): string {
    return ETIQUETA_ESTADO_OT[estado] ?? estado;
  }

  tono(estado: EstadoOt): string {
    return tonoEstadoOt(estado);
  }

  abrir(equipo: EquipoCliente): void {
    void this.router.navigate(['/cliente/ot', equipo.ultimaOtId]);
  }

  irASolicitar(): void {
    void this.router.navigate(['/cliente/solicitar']);
  }
}
