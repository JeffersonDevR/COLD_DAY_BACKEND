import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { MAPA_MOTOR } from '@core/maps/mapa-motor.token';
import type { Coordenada, EscenaMapa, MapaInstancia } from '@core/maps/mapa-motor';
import { decodificarPolyline } from '@core/maps/polyline';
import { MapaConfigService } from '@core/service/mapa-config.service';
import { rutaLocal } from '@core/service/distancia-local';
import { Point } from '@core/models/common.models';

/**
 * A6 — Mapa de seguimiento (WebView).
 *
 * No conoce al proveedor de mapas: dibuja a través del motor `MAPA_MOTOR`
 * (Google hoy; el backend elige el proveedor con `GET /api/config/maps`). El mapa dibuja UN par de
 * marcadores (técnico y punto de servicio) y UNA polilínea entre ambos: la
 * geometría real por calles si llegó por `rutaCodificada`, si no la recta.
 *
 * Degradación honesta: si el mapa no carga (proxy caído, key rechazada para
 * `capacitor://localhost`, sin red) el bloque completo se reemplaza por una
 * tarjeta con "Reintentar mapa" y el resto de la pantalla sigue funcionando.
 * Sin posición del técnico no se dibuja nada: mejor un mapa vacío que un dato
 * falso.
 */
@Component({
  selector: 'app-mapa-seguimiento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IonButton, IonIcon, IonSpinner],
  template: `
    <div class="cd-map__cabecera">
      <div>
        <p class="cd-map__titulo">Seguimiento en vivo</p>
        <p class="cd-map__nota">
          @if (llegada()) {
            Dónde está el técnico y si ya llegó al punto de servicio
          } @else {
            Dónde está el técnico y hacia dónde va
          }
        </p>
      </div>
      @if (llegada()) {
        <span class="cd-map__chip cd-map__chip--llegada" data-testid="mapa-llegada">
          <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon>
          {{ tecnicoNombre() }} ya llegó
        </span>
      } @else if (distanciaKm() !== null) {
        <span class="cd-map__chip" data-testid="mapa-distancia">
          <ion-icon name="navigate-outline" aria-hidden="true"></ion-icon>
          En camino: {{ distanciaKm() | number: '1.1-1' }} km
        </span>
      }
    </div>

    <div class="cd-map__lienzo">
      @if (motor.listo()) {
        @if (mostrarMapa()) {
          <!-- El canvas lo ocupa el motor de mapa de forma imperativa. -->
          <div #mapaEl class="cd-map__canvas" role="application"
               aria-label="Mapa con la ubicación del técnico y el punto de servicio"
               data-testid="mapa-canvas"></div>
        } @else {
          <div class="cd-map__vacio" data-testid="mapa-sin-posicion">
            <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
            <p class="cd-map__vacio-titulo">Todavía no hay posición del técnico</p>
            <p class="cd-map__vacio-texto">El mapa aparece en cuanto reporte su ubicación.</p>
          </div>
        }
      } @else if (motor.cargando() || reintentando()) {
        <div class="cd-map__cargando" data-testid="mapa-cargando">
          <ion-spinner name="dots"></ion-spinner>
          <p class="cd-map__vacio-texto">Cargando mapa…</p>
        </div>
      } @else {
        <div class="cd-map__fallback" role="alert" data-testid="mapa-fallback">
          <ion-icon name="map-outline" aria-hidden="true"></ion-icon>
          <p class="cd-map__fallback-titulo">Mapa no disponible</p>
          <p class="cd-map__vacio-texto">
            No pudimos cargar el mapa en esta sesión (puede ser la conexión o la
            configuración de la clave). La distancia y la ETA siguen visibles acá abajo.
          </p>
          <ion-button size="small" data-testid="mapa-reintentar"
                      [disabled]="reintentando()" (click)="reintentar()">
            <ion-icon slot="start" name="refresh-outline" aria-hidden="true"></ion-icon>
            Reintentar mapa
          </ion-button>
        </div>
      }
    </div>

    <p class="cd-map__resumen" aria-live="polite" data-testid="mapa-resumen">{{ resumen() }}</p>
  `,
})
export class MapaSeguimientoComponent {
  readonly motor = inject(MAPA_MOTOR);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapaConfig = inject(MapaConfigService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly posicionTecnico = input<Point | null>(null);
  readonly destino = input<Point | null>(null);
  readonly destinoNombre = input('Punto de servicio');
  readonly tecnicoNombre = input('El técnico');
  readonly llegada = input(false);
  readonly rutaCodificada = input<string | null>(null);

  /** `true` mientras el botón "Reintentar mapa" espera la respuesta del loader. */
  readonly reintentando = signal(false);

  private readonly mapaEl = viewChild<ElementRef<HTMLDivElement>>('mapaEl');
  private elementoActual: HTMLDivElement | null = null;
  /** `true` tras el primer fitBounds del par técnico-destino (no se re-encaja). */
  private limitesAjustados = false;
  private instancia: MapaInstancia | null = null;

  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly mostrarMapa = computed(() => this.posicionTecnico() !== null);

  /** Distancia en línea recta (haversine), la misma fuente que usa la página. */
  readonly distanciaKm = computed<number | null>(() => {
    const tecnico = this.posicionTecnico();
    const destino = this.destino();
    if (!tecnico || !destino) return null;
    return rutaLocal(tecnico, destino).distanciaKm;
  });

  /** Centro: el punto medio de la ruta, para ver técnico y destino a la vez. */
  private readonly centro = computed<Coordenada>(() => {
    const tecnico = this.posicionTecnico();
    const destino = this.destino();
    if (tecnico && destino) {
      return {
        lat: (tecnico.latitud + destino.latitud) / 2,
        lng: (tecnico.longitud + destino.longitud) / 2,
      };
    }
    const uno = tecnico ?? destino;
    if (uno) return { lat: uno.latitud, lng: uno.longitud };
    const centro = this.mapaConfig.centro();
    return { lat: centro.lat, lng: centro.lng };
  });

  readonly resumen = computed<string>(() => {
    if (this.llegada()) {
      return `${this.tecnicoNombre()} ya llegó al punto de servicio (${this.destinoNombre()}).`;
    }
    const tecnico = this.posicionTecnico();
    if (tecnico) {
      const km = this.distanciaKm();
      return km !== null
        ? `${this.tecnicoNombre()} está a ${km.toFixed(1)} km del punto de servicio (${this.destinoNombre()}).`
        : `${this.tecnicoNombre()} está en camino a ${this.destinoNombre()}.`;
    }
    return 'Todavía no hay posición del técnico: la distancia y el tiempo estimado aparecen cuando reporte su ubicación.';
  });

  constructor() {
    // Al salir de la pantalla el mapa y sus marcadores no se quedan vivos.
    this.destroyRef.onDestroy(() => this.descartarMapa());

    afterNextRender(() => {
      if (this.isBrowser) {
        void this.motor.cargar();
      }
    });

    // Crea el mapa cuando el loader termina y el canvas existe; después lo
    // sincroniza con cada sondeo (posición, geometría). La app es zoneless:
    // Google toca el DOM por su cuenta sin pasar por el scheduler.
    effect(() => {
      if (!this.motor.listo()) return;
      const el = this.mapaEl()?.nativeElement;
      if (!el) {
        // El canvas se quitó (p. ej. el técnico perdió su posición): se suelta el
        // mapa ya, no cuando aparezca otro nodo.
        this.descartarMapa();
        this.elementoActual = null;
        return;
      }
      if (el !== this.elementoActual) {
        // Angular recreó el nodo (p. ej. alternó el estado vacío): se rehace.
        this.descartarMapa();
        this.elementoActual = el;
      }
      this.sincronizarMapa(el);
    });
  }

  /** Reintenta la carga del mapa tras un fallo; el resto de la pantalla no se toca. */
  async reintentar(): Promise<void> {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    try {
      await this.motor.reintentar();
    } finally {
      this.reintentando.set(false);
    }
  }

  private sincronizarMapa(el: HTMLDivElement): void {
    const zoom = this.mapaConfig.zoom();
    this.instancia ??= this.motor.crear(el, {
      centro: this.centro(),
      zoom,
      zoomMin: zoom - 2,
      zoomMax: 18,
      limites: this.mapaConfig.bounds(),
    });

    const tecnico = this.posicionTecnico();
    const destino = this.destino();
    const tecnicoPos: Coordenada | null = tecnico ? { lat: tecnico.latitud, lng: tecnico.longitud } : null;
    const destinoPos: Coordenada | null = destino ? { lat: destino.latitud, lng: destino.longitud } : null;

    const escena: EscenaMapa = { marcadores: [], lineas: [] };
    if (tecnicoPos) {
      escena.marcadores.push({
        id: 'tecnico',
        posicion: tecnicoPos,
        titulo: this.tecnicoNombre(),
        estilo: 'tecnico',
      });
    }
    if (destinoPos) {
      escena.marcadores.push({
        id: 'destino',
        posicion: destinoPos,
        titulo: this.destinoNombre(),
        estilo: 'destino',
      });
    }
    // La ruta: geometría real por calles si se pudo decodificar; si no, la recta.
    const puntos =
      decodificarPolyline(this.rutaCodificada()) ??
      (tecnicoPos && destinoPos ? [tecnicoPos, destinoPos] : null);
    if (puntos) {
      escena.lineas.push({ id: 'ruta', puntos });
    }
    this.instancia.actualizar(escena);

    if (tecnicoPos && destinoPos) {
      // Encaja técnico y destino la primera vez que hay par: con centro y
      // zoom fijos el marcador lejano quedaba fuera del encuadre y la línea
      // parecía no conectar. Después el usuario conserva su zoom.
      if (!this.limitesAjustados) {
        this.limitesAjustados = true;
        this.instancia.ajustarA([tecnicoPos, destinoPos], 48);
      }
    } else {
      this.limitesAjustados = false;
      this.instancia.centrarEn(this.centro());
    }
  }

  private descartarMapa(): void {
    this.instancia?.destruir();
    this.instancia = null;
    // Un mapa nuevo vuelve a encuadrar el par técnico-destino.
    this.limitesAjustados = false;
  }
}
