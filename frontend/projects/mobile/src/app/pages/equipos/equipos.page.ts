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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { esErrorPerfilClienteFaltante } from '@core/errorStatus/perfil-cliente';
import { CategoriaServicio, EstadoOt, OtResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ETIQUETA_ESTADO_OT, tonoEstadoOt } from '@core/service/estado-ot';
import { ClientesApi } from '@core/service/clientes-api';
import { EquipoCliente, agruparEquipos } from '@core/service/equipos-cliente';

/**
 * A10 — Mis equipos (cliente).
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
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Mis equipos</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (cargando()) {
        <div class="cd-cargando" data-testid="equipos-cargando" aria-busy="true">
          <ion-spinner name="dots"></ion-spinner>
          <p class="cd-muted">Cargando tus equipos...</p>
        </div>
      } @else if (sinPerfilCliente()) {
        <section class="cd-alerta cd-alerta--aviso" role="status" data-testid="equipos-sin-perfil">
          <h2 class="cd-alerta__titulo">Todavía no tenés perfil de cliente</h2>
          <p class="cd-alerta__texto">
            Necesitamos tus datos para asociar los equipos a tu cuenta. Los completás al pedir tu
            primer servicio.
          </p>
          <ion-button class="cd-cta" data-testid="equipos-crear-perfil" (click)="irASolicitar()">
            Pedir un servicio
          </ion-button>
        </section>
      } @else if (errorCarga()) {
        <section class="cd-alerta cd-alerta--error" role="alert" data-testid="equipos-error">
          <h2 class="cd-alerta__titulo">No pudimos cargar tus equipos</h2>
          <p class="cd-alerta__texto">
            Revisá la conexión y volvé a intentar. Tus órdenes siguen guardadas.
          </p>
          <ion-button class="cd-cta" data-testid="equipos-reintentar" (click)="cargar()">
            Reintentar
          </ion-button>
        </section>
      } @else if (!equipos().length) {
        <section class="cd-vacio" data-testid="equipos-vacio">
          <ion-icon name="cube-outline" aria-hidden="true"></ion-icon>
          <h2 class="cd-vacio__titulo">Todavía no tenés equipos</h2>
          <p class="cd-vacio__texto">
            Cuando pidas un servicio, el equipo queda registrado con su historial.
          </p>
        </section>
      } @else {
        <p class="cd-eyebrow">{{ equipos().length }} equipos · historial completo</p>

        @for (equipo of equipos(); track equipo.categoria) {
          <ion-card class="cd-ot" data-testid="equipo">
            <ion-card-content>
              <div class="cd-ot__cabecera">
                <span class="cd-ot__icono" aria-hidden="true">
                  <ion-icon [name]="iconoDe(equipo.categoria)"></ion-icon>
                </span>
                <div class="cd-ot__titulos">
                  <span class="cd-ot__codigo">{{ equipo.codigoOt }}</span>
                  <h2 class="cd-ot__categoria">{{ equipo.etiqueta }}</h2>
                </div>
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

    <ion-footer class="ion-no-border">
      <ion-toolbar>
        <ion-button expand="block" fill="outline" (click)="irASolicitar()">
          Registrar otro equipo
        </ion-button>
      </ion-toolbar>
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

  /** Iconografía de la plataforma. El `@core` no la conoce a propósito. */
  private readonly iconos: Record<CategoriaServicio, string> = {
    AIRE_ACONDICIONADO: 'snow-outline',
    REFRIGERACION: 'thermometer-outline',
    LAVADORAS: 'sync-outline',
    ELECTRICIDAD: 'flash-outline',
    CAMARAS_VIGILANCIA: 'videocam-outline',
  };

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

  iconoDe(categoria: CategoriaServicio): string {
    return this.iconos[categoria] ?? 'cube-outline';
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
