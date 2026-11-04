import {
  ChangeDetectionStrategy,
  Component,
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
import { GoogleMapsLoaderService } from '@core/service/google-maps-loader';
import { MapaConfigService } from '@core/service/mapa-config.service';
import { rutaLocal } from '@core/service/distancia-local';
import { decodificarRuta } from '@core/service/polyline-ruta';
import { MAPA_ESTILOS } from '@core/service/mapa-estilos';
import { Point } from '@core/models/common.models';

/**
 * A6 — Mapa de seguimiento (WebView + Google Maps JavaScript).
 *
 * El navegador embebe el mismo loader que la web (`GoogleMapsLoaderService`):
 * la browser key sale de la configuración inyectada en build o de
 * `GET /api/config/maps`, nunca de una clave nueva. El mapa dibuja UN par de
 * marcadores (técnico y punto de servicio) y UNA polilínea entre ambos: la
 * geometría real por calles si llegó por `rutaCodificada`, si no la recta.
 *
 * Degradación honesta: si Maps no carga (proxy caído, key rechazada para
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
      @if (mapsLoader.isLoaded()) {
        @if (mostrarMapa()) {
          <!-- El canvas lo ocupa Google Maps de forma imperativa. -->
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
      } @else if (mapsLoader.isLoading() || reintentando()) {
        <div class="cd-map__cargando" data-testid="mapa-cargando">
          <ion-spinner name="dots"></ion-spinner>
          <p class="cd-map__vacio-texto">Cargando mapa…</p>
        </div>
      } @else {
        <div class="cd-map__fallback" role="alert" data-testid="mapa-fallback">
          <ion-icon name="map-outline" aria-hidden="true"></ion-icon>
          <p class="cd-map__fallback-titulo">Mapa no disponible</p>
          <p class="cd-map__vacio-texto">
            No pudimos cargar Google Maps en esta sesión (puede ser la conexión o la
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
  readonly mapsLoader = inject(GoogleMapsLoaderService);
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
  private mapa: google.maps.Map | null = null;
  private marcadorTecnico: google.maps.Marker | null = null;
  private marcadorDestino: google.maps.Marker | null = null;
  private polyline: google.maps.Polyline | null = null;

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
  private readonly centro = computed<google.maps.LatLngLiteral>(() => {
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
    afterNextRender(() => {
      if (this.isBrowser) {
        void this.mapsLoader.init();
      }
    });

    // Crea el mapa cuando el loader termina y el canvas existe; después lo
    // sincroniza con cada sondeo (posición, geometría). La app es zoneless:
    // Google toca el DOM por su cuenta sin pasar por el scheduler.
    effect(() => {
      if (!this.mapsLoader.isLoaded()) return;
      const el = this.mapaEl()?.nativeElement;
      if (!el) return;
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
      await this.mapsLoader.reintentar();
    } finally {
      this.reintentando.set(false);
    }
  }

  private sincronizarMapa(el: HTMLDivElement): void {
    this.mapa ??= new google.maps.Map(el, this.opcionesMapa());

    const tecnico = this.posicionTecnico();
    const destino = this.destino();
    const tecnicoPos = tecnico ? { lat: tecnico.latitud, lng: tecnico.longitud } : null;
    const destinoPos = destino ? { lat: destino.latitud, lng: destino.longitud } : null;

    this.marcadorTecnico = this.sincronizarMarcador(
      this.marcadorTecnico,
      tecnicoPos,
      this.tecnicoNombre(),
      opcionesMarcadorTecnico(),
    );
    this.marcadorDestino = this.sincronizarMarcador(
      this.marcadorDestino,
      destinoPos,
      this.destinoNombre(),
      opcionesMarcadorDestino(),
    );

    // La ruta: geometría real por calles si se pudo decodificar; si no, la recta.
    const puntos =
      decodificarRuta(this.rutaCodificada()) ??
      (tecnicoPos && destinoPos ? [tecnicoPos, destinoPos] : null);
    if (puntos && puntos.length >= 2) {
      if (this.polyline) {
        this.polyline.setPath(puntos);
      } else {
        this.polyline = new google.maps.Polyline({
          path: puntos,
          strokeColor: '#22d3ee',
          strokeOpacity: 0.9,
          strokeWeight: 3,
        });
        this.polyline.setMap(this.mapa);
      }
    } else {
      this.polyline?.setMap(null);
      this.polyline = null;
    }

    if (this.mapa) {
      this.mapa.setCenter(this.centro());
    }
  }

  private sincronizarMarcador(
    actual: google.maps.Marker | null,
    posicion: google.maps.LatLngLiteral | null,
    titulo: string,
    opciones: google.maps.MarkerOptions,
  ): google.maps.Marker | null {
    if (!posicion) {
      actual?.setMap(null);
      return null;
    }
    if (actual) {
      actual.setPosition(posicion);
      actual.setTitle(titulo);
      return actual;
    }
    const marcador = new google.maps.Marker({ ...opciones, position: posicion, title: titulo });
    marcador.setMap(this.mapa);
    return marcador;
  }

  private opcionesMapa(): google.maps.MapOptions {
    const zoom = this.mapaConfig.zoom();
    return {
      zoom,
      minZoom: zoom - 2,
      maxZoom: 18,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: MAPA_ESTILOS,
      restriction: {
        latLngBounds: this.mapaConfig.bounds(),
        strictBounds: true,
      },
    };
  }

  private descartarMapa(): void {
    this.polyline?.setMap(null);
    this.polyline = null;
    this.marcadorTecnico?.setMap(null);
    this.marcadorTecnico = null;
    this.marcadorDestino?.setMap(null);
    this.marcadorDestino = null;
    this.mapa = null;
  }
}

/** Marcador cian (Stitch "primary") para el técnico. */
function opcionesMarcadorTecnico(): google.maps.MarkerOptions {
  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#22d3ee',
      fillOpacity: 1,
      strokeColor: '#04121a',
      strokeWeight: 2,
    },
    zIndex: 2,
  };
}

/** Marcador ámbar (Stitch "secondary") para el punto de servicio. */
function opcionesMarcadorDestino(): google.maps.MarkerOptions {
  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#f59e0b',
      fillOpacity: 1,
      strokeColor: '#1a1204',
      strokeWeight: 2,
    },
    zIndex: 1,
  };
}
