import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';
import { GeolocationService } from '../../core/service/geolocation.service';
import { ToastService } from '../../core/alertas/toast.service';
import { Point } from '../../core/models/common.models';
import { MapaConfigService } from '../../core/service/mapa-config.service';

/**
 * Selector de domicilio sobre Google Maps.
 *
 * El usuario fija su punto tocando el mapa, arrastrando el pin o con el GPS del
 * dispositivo. El componente NO geocodifica: solo emite la coordenada elegida
 * mediante `ubicacionChange`; resolver la dirección textual es responsabilidad
 * de quien lo consume (vía el proxy `/api/maps/inversa`). Así el componente se
 * mantiene reutilizable y sin lógica de negocio.
 *
 * Es progresivo: si la API de Google no está disponible (p. ej. sin key de
 * navegador), degrada a un panel conservando el botón GPS, que no depende de la
 * key — solo del render visual del mapa.
 */
@Component({
  selector: 'app-selector-ubicacion-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleMap, MapMarker],
  templateUrl: './selector-ubicacion-mapa.html',
})
export class SelectorUbicacionMapa implements OnInit {
  readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly geolocation = inject(GeolocationService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapaConfig = inject(MapaConfigService);

  readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Coordenada fijada; `null` mientras el usuario no haya elegido un punto. */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);
  /** Alto del lienzo del mapa (p. ej. "320px", "60vh"). */
  readonly alto = input<string>('320px');

  /** Emite la coordenada cada vez que el usuario fija o mueve el punto. */
  readonly ubicacionChange = output<Point>();

  readonly resolviendoGps = signal<boolean>(false);

  /** Centro por defecto: el que publica el backend (nunca una copia local). */
  readonly centroDefecto = computed<google.maps.LatLngLiteral>(() => {
    const centro = this.mapaConfig.centro();
    return { lat: centro.lat, lng: centro.lng };
  });

  readonly puntoActual = computed<google.maps.LatLngLiteral | null>(() => {
    const lat = this.lat();
    const lng = this.lng();
    return lat === null || lng === null ? null : { lat, lng };
  });

  readonly centro = computed<google.maps.LatLngLiteral>(() => this.puntoActual() ?? this.centroDefecto());

  readonly zoomNivel = computed<number>(() => (this.puntoActual() ? 16 : 12.5));

  readonly markerOptions = computed<google.maps.MarkerOptions>(() => ({
    position: this.puntoActual() ?? this.centroDefecto(),
    draggable: true,
    clickable: true,
    title: 'Arrastra para ajustar tu domicilio',
  }));

  readonly mapOptions = computed<google.maps.MapOptions>(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeControl: false,
    // Restricción estricta al área metropolitana: no se puede salir de Cúcuta.
    restriction: {
      latLngBounds: this.mapaConfig.bounds(),
      strictBounds: true,
    },
  }));

  ngOnInit(): void {
    if (this.isBrowser) {
      this.mapsLoader.init();
    }
  }

  alClickearMapa(evento: google.maps.MapMouseEvent): void {
    this.emitir(evento.latLng);
  }

  alSoltarPin(evento: google.maps.MapMouseEvent): void {
    this.emitir(evento.latLng);
  }

  usarMiUbicacion(): void {
    if (!this.geolocation.disponible) {
      this.toast.error('No disponible', 'Tu navegador no soporta geolocalización.');
      return;
    }
    this.resolviendoGps.set(true);
    this.geolocation
      .obtenerPosicion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (punto) => {
          this.resolviendoGps.set(false);
          this.ubicacionChange.emit(punto);
        },
        error: (err: Error) => {
          this.resolviendoGps.set(false);
          this.toast.error('Ubicación no disponible', err.message);
        },
      });
  }

  private emitir(latLng: google.maps.LatLng | null | undefined): void {
    if (!latLng) return;
    this.ubicacionChange.emit({ latitud: latLng.lat(), longitud: latLng.lng() });
  }
}
