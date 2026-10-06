// Source: Google Maps Platform Code Assist
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  viewChild
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import {
  GoogleMap,
  MapMarker,
  MapCircle,
  MapInfoWindow
} from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../core/service/google-maps-loader';

export interface RadarTecnicoItem {
  id: string;
  nombre: string;
  especialidad: string;
  distanciaKm: number;
  lat: number;
  lng: number;
  disponible: boolean;
  vehiculo?: string;
  reputacion?: number;
}

// Límites geográficos estrictos del Área Metropolitana de Cúcuta
// Incluye Cúcuta, Los Patios, Villa del Rosario, San Cayetano y corredores viales
export const CUCUTA_METRO_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 8.0800,  // Norte: El Salado / Aeropuerto Camilo Daza / Trigal del Norte
  south: 7.7600,  // Sur: Los Patios / Villa del Rosario / La Parada
  west: -72.6000, // Oeste: San Cayetano / Antonia Santos / Belisario
  east: -72.4100  // Este: Boconó / Escobal / Anillo Vial Oriental
};

@Component({
  selector: 'app-mapa-radar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    GoogleMap,
    MapMarker,
    MapCircle,
    MapInfoWindow
  ],
  templateUrl: './mapa-radar.html',
  styleUrl: './mapa-radar.css'
})
export class MapaRadar implements OnInit, OnDestroy {
  readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isBrowser = isPlatformBrowser(this.platformId);

  // ViewChilds para InfoWindows de Google Maps
  readonly infoWindow = viewChild<MapInfoWindow>('infoWindow');
  readonly clienteInfoWindow = viewChild<MapInfoWindow>('clienteInfoWindow');

  readonly radioInicial = input<number>(10);
  readonly isBuscando = input<boolean>(true);
  readonly clienteUbicacionNombre = input<string>('Tu Domicilio');
  readonly centroLat = input<number>(7.8939);
  readonly centroLng = input<number>(-72.5078);
  /** Técnicos reales del backend; si es null se usa la lista demo local. */
  readonly tecnicosExternos = input<RadarTecnicoItem[] | null>(null);
  readonly radioCambiado = output<number>();

  readonly radioActualKm = signal<number>(10);
  readonly segundosRestantes = signal<number>(58);
  readonly vistaModo = signal<'hibrido' | 'mapa' | 'vectorial'>('hibrido');
  readonly selectedTecnico = signal<RadarTecnicoItem | null>(null);

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Centro en Cúcuta
  readonly centroUbicacion = computed<google.maps.LatLngLiteral>(() => {
    return {
      lat: this.centroLat(),
      lng: this.centroLng()
    };
  });

  // Radio en metros para Google Maps Circle
  readonly radioMetros = computed<number>(() => {
    return this.radioActualKm() * 1000;
  });

  // Nivel de zoom según el radio de cobertura acotado al área metropolitana
  readonly zoomNivel = computed<number>(() => {
    const km = this.radioActualKm();
    if (km <= 10) return 13;
    if (km <= 15) return 12.2;
    if (km <= 20) return 11.8;
    return 11.5;
  });

  // Opciones de configuración de Google Maps con el Solutions Attribution ID requerido
  // y restricción estricta de navegación al Área Metropolitana de Cúcuta
  readonly mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    // Límites de zoom para no alejarse de Cúcuta y sus sectores aledaños
    minZoom: 11.5,
    maxZoom: 18,
    // Restricción geográfica estricta: impide desplazarse fuera de Cúcuta, Los Patios y Villa del Rosario
    restriction: {
      latLngBounds: CUCUTA_METRO_BOUNDS,
      strictBounds: true
    },
    // Mandatory usage tracking attribution ID for AI Studio
    internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
      {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#38bdf8' }]
      },
      {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#64748b' }]
      },
      {
        featureType: 'poi.park',
        elementType: 'geometry',
        stylers: [{ color: '#0f291e' }]
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#334155' }]
      },
      {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1e293b' }]
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#0284c7' }]
      },
      {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#1e293b' }]
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#0c4a6e' }]
      }
    ]
  };

  // Opciones del círculo activo de cobertura
  readonly activeCircleOptions = computed<google.maps.CircleOptions>(() => ({
    strokeColor: '#0284c7',
    strokeOpacity: 0.9,
    strokeWeight: 2.5,
    fillColor: '#0ea5e9',
    fillOpacity: 0.16
  }));

  // Opciones de círculos concéntricos de referencia
  readonly referenceCircleOptions: google.maps.CircleOptions = {
    strokeColor: '#38bdf8',
    strokeOpacity: 0.35,
    strokeWeight: 1,
    fillColor: '#000000',
    fillOpacity: 0.0
  };

  readonly limitCircleOptions: google.maps.CircleOptions = {
    strokeColor: '#0284c7',
    strokeOpacity: 0.5,
    strokeWeight: 1.5,
    fillColor: '#000000',
    fillOpacity: 0.0
  };

  // Opciones del marcador del cliente (punto azul central)
  readonly clienteMarkerOptions = {
    icon: {
      path: 0 as google.maps.SymbolPath, // SymbolPath.CIRCLE (sin tocar google en runtime)
      scale: 8,
      fillColor: '#0284c7',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2.5
    }
  };

  // Lista demo de respaldo (solo si no llegan técnicos reales del backend).
  private readonly tecnicosDemo = signal<RadarTecnicoItem[]>([
    {
      id: '1',
      nombre: 'Juan P.',
      especialidad: 'Aire Acondicionado Inverter',
      distanciaKm: 3.2,
      lat: 7.8860,
      lng: -72.4980, // Caobos
      disponible: true,
      vehiculo: 'Moto Taller',
      reputacion: 4.9
    },
    {
      id: '2',
      nombre: 'Andrés S.',
      especialidad: 'Refrigeración Comercial',
      distanciaKm: 7.8,
      lat: 7.9050,
      lng: -72.5020, // Guaimaral
      disponible: true,
      vehiculo: 'Furgón Herramientas',
      reputacion: 4.8
    },
    {
      id: '3',
      nombre: 'Carlos R.',
      especialidad: 'Electricidad y Redes 220V',
      distanciaKm: 13.5,
      lat: 7.8750,
      lng: -72.4850, // Prados del Este
      disponible: true,
      vehiculo: 'Moto',
      reputacion: 4.9
    },
    {
      id: '4',
      nombre: 'Héctor M.',
      especialidad: 'Línea Blanca / Lavadoras',
      distanciaKm: 18.0,
      lat: 7.8420,
      lng: -72.5080, // Los Patios / Centro
      disponible: true,
      vehiculo: 'Camioneta Taller',
      reputacion: 4.7
    }
  ]);

  // Técnicos a pintar: reales del backend si vienen, si no la lista demo.
  readonly tecnicos = computed<RadarTecnicoItem[]>(() => this.tecnicosExternos() ?? this.tecnicosDemo());

  readonly tecnicosEnRango = computed(() => {
    const radio = this.radioActualKm();
    return this.tecnicos().filter(t => t.distanciaKm <= radio);
  });

  // Conversión a escala para la vista SVG (fallback)
  readonly activeRadiusSvg = computed<number>(() => {
    return Math.min(175, this.radioActualKm() * 7);
  });

  getSvgX(tec: RadarTecnicoItem): number {
    // Proyección de coordenadas relativas a Cúcuta Centro hacia canvas de 400x400
    const deltaLng = (tec.lng - this.centroLng()) * 800;
    return 200 + deltaLng;
  }

  getSvgY(tec: RadarTecnicoItem): number {
    const deltaLat = (this.centroLat() - tec.lat) * 800;
    return 200 + deltaLat;
  }

  getTecnicoMarkerOptions(tec: RadarTecnicoItem) {
    const enRango = tec.distanciaKm <= this.radioActualKm();
    return {
      icon: {
        path: 0 as google.maps.SymbolPath, // SymbolPath.CIRCLE
        scale: enRango ? 6.5 : 5,
        fillColor: enRango ? '#10b981' : '#64748b',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 1.5
      }
    };
  }

  ngOnInit(): void {
    this.radioActualKm.set(this.radioInicial());
    this.iniciarTemporizador();

    // Iniciar carga de Google Maps si estamos en el navegador
    if (this.isBrowser) {
      this.mapsLoader.init();
    }
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
  }

  abrirInfoTecnico(marker: MapMarker, tec: RadarTecnicoItem): void {
    this.selectedTecnico.set(tec);
    const win = this.infoWindow();
    if (win) {
      win.open(marker);
    }
  }

  abrirInfoCliente(marker: MapMarker): void {
    const win = this.clienteInfoWindow();
    if (win) {
      win.open(marker);
    }
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.timerInterval = setInterval(() => {
      if (!this.isBuscando()) return;

      const seg = this.segundosRestantes();
      if (seg > 1) {
        this.segundosRestantes.set(seg - 1);
      } else {
        // Expiró 60s -> crecer +5 km si no ha alcanzado 25 km
        this.segundosRestantes.set(60);
        const actual = this.radioActualKm();
        if (actual < 25) {
          const nuevo = actual + 5;
          this.radioActualKm.set(nuevo);
          this.radioCambiado.emit(nuevo);
        }
      }
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  simularExpansionRadio(): void {
    const actual = this.radioActualKm();
    if (actual < 25) {
      const nuevo = actual + 5;
      this.radioActualKm.set(nuevo);
      this.segundosRestantes.set(60);
      this.radioCambiado.emit(nuevo);
    }
  }

  reiniciarRadar(): void {
    this.radioActualKm.set(10);
    this.segundosRestantes.set(60);
    this.radioCambiado.emit(10);
  }
}
