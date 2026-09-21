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
import { MatIconModule } from '@angular/material/icon';
import {
  GoogleMap,
  MapMarker,
  MapCircle,
  MapInfoWindow
} from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../../core/shared/infrastructure/maps/google-maps-loader';

export interface RadarTecnicoItem {
  id: string;
  nombre: string;
  especialidad: string;
  distanciaKm: number;
  lat: number;
  lng: number;
  disponible: boolean;
  vehiculo: string;
  reputacion: number;
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
    MatIconModule,
    DecimalPipe,
    GoogleMap,
    MapMarker,
    MapCircle,
    MapInfoWindow
  ],
  template: `
    <div class="relative w-full bg-slate-900 rounded-3xl p-4 sm:p-6 text-white overflow-hidden shadow-2xl border border-slate-800">
      <!-- Encabezado del radar y controles de vista -->
      <div class="flex flex-wrap items-center justify-between gap-3 z-20 relative mb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
            <h3 class="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <span>Radar Georreferenciado Google Maps</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">Cúcuta</span>
            </h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            Rastreo perimetral en vivo sobre cartografía satelital y vial
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Selector de Modo de Visualización -->
          <div class="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700 text-xs">
            <button
              type="button"
              (click)="vistaModo.set('hibrido')"
              class="px-2.5 py-1 rounded-lg font-semibold transition-colors"
              [class.bg-sky-600]="vistaModo() === 'hibrido'"
              [class.text-white]="vistaModo() === 'hibrido'"
              [class.text-slate-400]="vistaModo() !== 'hibrido'"
              title="Google Maps con barrido táctico superpuesto"
            >
              Híbrido Radar
            </button>
            <button
              type="button"
              (click)="vistaModo.set('mapa')"
              class="px-2.5 py-1 rounded-lg font-semibold transition-colors"
              [class.bg-sky-600]="vistaModo() === 'mapa'"
              [class.text-white]="vistaModo() === 'mapa'"
              [class.text-slate-400]="vistaModo() !== 'mapa'"
              title="Google Maps interactivo completo"
            >
              Mapa Vial
            </button>
            <button
              type="button"
              (click)="vistaModo.set('vectorial')"
              class="px-2.5 py-1 rounded-lg font-semibold transition-colors"
              [class.bg-sky-600]="vistaModo() === 'vectorial'"
              [class.text-white]="vistaModo() === 'vectorial'"
              [class.text-slate-400]="vistaModo() !== 'vectorial'"
              title="Radar HUD vectorial puro"
            >
              Sonar SVG
            </button>
          </div>

          <!-- Radio actual -->
          <div class="px-3 py-1 rounded-xl bg-slate-800/80 border border-sky-500/30 text-xs flex items-center gap-1.5">
            <mat-icon class="text-xs text-sky-400" style="font-size: 14px; width: 14px; height: 14px;">radar</mat-icon>
            <span class="text-slate-400">Radio:</span>
            <span class="font-bold text-sky-300">{{ radioActualKm() }} km</span>
          </div>

          <!-- Cuenta regresiva 60s -->
          @if (isBuscando()) {
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-950/80 border border-sky-400/50 text-xs">
              <mat-icon class="text-sky-400 text-sm animate-spin" style="font-size: 14px; width: 14px; height: 14px;">sync</mat-icon>
              <span class="text-slate-300 hidden sm:inline">Expande:</span>
              <span class="font-mono font-bold text-sky-300">{{ segundosRestantes() }}s</span>
            </div>
          }
        </div>
      </div>

      <!-- Contenedor del Mapa / Radar -->
      <div class="relative w-full h-[380px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <!-- VISTA 1: GOOGLE MAPS (Híbrido o Mapa Puro) -->
        @if (isBrowser && mapsLoader.isLoaded() && (vistaModo() === 'hibrido' || vistaModo() === 'mapa')) {
          <div class="relative w-full h-full">
            <google-map
              [center]="centroUbicacion()"
              [zoom]="zoomNivel()"
              [options]="mapOptions"
              height="100%"
              width="100%"
            >
              <!-- Círculo de Cobertura Activa del Radar (Radio Dinámico en Metros) -->
              <map-circle
                [center]="centroUbicacion()"
                [radius]="radioMetros()"
                [options]="activeCircleOptions()"
              />

              <!-- Círculos de referencia perimetral (10 km, 15 km, 20 km, 25 km límite) -->
              <map-circle
                [center]="centroUbicacion()"
                [radius]="10000"
                [options]="referenceCircleOptions"
              />
              <map-circle
                [center]="centroUbicacion()"
                [radius]="15000"
                [options]="referenceCircleOptions"
              />
              <map-circle
                [center]="centroUbicacion()"
                [radius]="20000"
                [options]="referenceCircleOptions"
              />
              <map-circle
                [center]="centroUbicacion()"
                [radius]="25000"
                [options]="limitCircleOptions"
              />

              <!-- Marcador Central: Domicilio / Ubicación del Cliente -->
              <map-marker
                #clienteMarker="mapMarker"
                [position]="centroUbicacion()"
                [title]="clienteUbicacionNombre() + ' (Punto Central)'"
                [options]="clienteMarkerOptions"
                (mapClick)="abrirInfoCliente(clienteMarker)"
              />

              <!-- Marcadores de Técnicos en Cúcuta -->
              @for (tec of tecnicos(); track tec.id) {
                <map-marker
                  #tecMarker="mapMarker"
                  [position]="{ lat: tec.lat, lng: tec.lng }"
                  [title]="tec.nombre + ' (' + tec.distanciaKm + ' km)'"
                  [options]="getTecnicoMarkerOptions(tec)"
                  (mapClick)="abrirInfoTecnico(tecMarker, tec)"
                />
              }

              <!-- InfoWindow de Técnico -->
              <map-info-window #infoWindow="mapInfoWindow">
                @if (selectedTecnico(); as t) {
                  <div class="p-2 text-slate-900 max-w-[220px]">
                    <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-1.5">
                      <span class="font-bold text-xs text-slate-800">{{ t.nombre }}</span>
                      <span class="text-[11px] font-bold text-amber-500 inline-flex items-center">
                        ★ {{ t.reputacion }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-600 mb-1">
                      <strong>Especialidad:</strong> {{ t.especialidad }}
                    </p>
                    <p class="text-[11px] text-slate-600 mb-1">
                      <strong>Vehículo:</strong> {{ t.vehiculo }}
                    </p>
                    <div class="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px]">
                      <span class="text-slate-500">Distancia:</span>
                      <span class="font-bold text-sky-700">{{ t.distanciaKm }} km</span>
                    </div>
                    <div class="mt-1 text-center">
                      @if (t.distanciaKm <= radioActualKm()) {
                        <span class="inline-block w-full py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          ✓ Dentro del radio activo
                        </span>
                      } @else {
                        <span class="inline-block w-full py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                          Fuera del radio ({{ t.distanciaKm - radioActualKm() | number:'1.1-1' }} km más)
                        </span>
                      }
                    </div>
                  </div>
                }
              </map-info-window>

              <!-- InfoWindow de Cliente -->
              <map-info-window #clienteInfoWindow="mapInfoWindow">
                <div class="p-2 text-slate-900 max-w-[200px]">
                  <div class="font-bold text-xs text-sky-800 mb-0.5">Ubicación del Servicio</div>
                  <div class="text-[11px] text-slate-700">{{ clienteUbicacionNombre() }}</div>
                  <div class="text-[10px] text-slate-500 mt-1">Centro del radar de asignación</div>
                </div>
              </map-info-window>
            </google-map>

            <!-- SUPERPOSICIÓN DE HAZ DE RADAR TÁCTICO (Modo Híbrido) -->
            @if (vistaModo() === 'hibrido') {
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <!-- SVG Cono de barrido y retícula centrada -->
                <svg viewBox="0 0 400 400" class="w-full h-full max-w-[400px] max-h-[400px] opacity-80">
                  <defs>
                    <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45" />
                      <stop offset="50%" stop-color="#0284c7" stop-opacity="0.15" />
                      <stop offset="100%" stop-color="#0369a1" stop-opacity="0" />
                    </linearGradient>
                  </defs>

                  <!-- Retícula circular del radar -->
                  <circle cx="200" cy="200" r="180" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 3" opacity="0.4" />
                  <circle cx="200" cy="200" r="120" fill="none" stroke="#38bdf8" stroke-width="0.8" opacity="0.3" />
                  <circle cx="200" cy="200" r="60" fill="none" stroke="#38bdf8" stroke-width="0.8" opacity="0.3" />

                  <!-- Ejes de mira -->
                  <line x1="200" y1="20" x2="200" y2="380" stroke="#38bdf8" stroke-width="0.75" stroke-dasharray="2 4" opacity="0.4" />
                  <line x1="20" y1="200" x2="380" y2="200" stroke="#38bdf8" stroke-width="0.75" stroke-dasharray="2 4" opacity="0.4" />

                  <!-- Haz giratorio -->
                  <g class="animate-radar-spin origin-center">
                    <path
                      d="M 200 200 L 200 20 A 180 180 0 0 1 350 100 Z"
                      fill="url(#sweepGrad)"
                    />
                  </g>
                </svg>
              </div>
            }
          </div>
        } @else {
          <!-- VISTA 2: RADAR TÁCTICO VECTORIAL SVG (Si no hay key de Maps o se selecciona Sonar SVG) -->
          <div class="relative w-full h-full flex items-center justify-center p-4">
            <svg viewBox="0 0 400 400" class="w-full h-full max-w-[360px] overflow-visible">
              <defs>
                <radialGradient id="radarGlowSvg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.25" />
                  <stop offset="70%" stop-color="#0284c7" stop-opacity="0.06" />
                  <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="sweepGradSvg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.4" />
                  <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0" />
                </linearGradient>
              </defs>

              <circle cx="200" cy="200" r="180" fill="url(#radarGlowSvg)" />
              <line x1="200" y1="10" x2="200" y2="390" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />
              <line x1="10" y1="200" x2="390" y2="200" stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />

              <!-- Círculos concéntricos de referencia -->
              <circle cx="200" cy="200" r="70" fill="none" [attr.stroke]="radioActualKm() >= 10 ? '#0ea5e9' : '#1e293b'" stroke-width="1" />
              <text x="205" y="135" fill="#64748b" font-size="10" font-family="monospace">10 km</text>

              <circle cx="200" cy="200" r="105" fill="none" [attr.stroke]="radioActualKm() >= 15 ? '#0ea5e9' : '#1e293b'" stroke-width="1" />
              <text x="205" y="100" fill="#64748b" font-size="10" font-family="monospace">15 km</text>

              <circle cx="200" cy="200" r="140" fill="none" [attr.stroke]="radioActualKm() >= 20 ? '#0ea5e9' : '#1e293b'" stroke-width="1" />
              <text x="205" y="65" fill="#64748b" font-size="10" font-family="monospace">20 km</text>

              <circle cx="200" cy="200" r="175" fill="none" [attr.stroke]="radioActualKm() >= 25 ? '#38bdf8' : '#1e293b'" stroke-width="1.5" stroke-dasharray="4 4" />
              <text x="205" y="30" fill="#64748b" font-size="10" font-family="monospace">25 km (Límite)</text>

              <!-- Área activa iluminada -->
              <circle
                cx="200" cy="200"
                [attr.r]="activeRadiusSvg()"
                fill="#0ea5e9"
                fill-opacity="0.12"
                stroke="#22d3ee"
                stroke-width="1.5"
                class="transition-all duration-700 ease-out"
              />

              <!-- Haz de barrido -->
              <g class="animate-radar-spin origin-center">
                <path d="M 200 200 L 200 25 A 175 175 0 0 1 350 110 Z" fill="url(#sweepGradSvg)" />
              </g>

              <!-- Referencias geográficas Cúcuta -->
              <text x="270" y="170" fill="#475569" font-size="9" font-weight="600">Caobos</text>
              <text x="140" y="150" fill="#475569" font-size="9" font-weight="600">Centro</text>
              <text x="230" y="270" fill="#475569" font-size="9" font-weight="600">Prados del Este</text>
              <text x="130" y="250" fill="#475569" font-size="9" font-weight="600">Guaimaral</text>

              <!-- Marcadores de técnicos en el radar SVG -->
              @for (tec of tecnicos(); track tec.id) {
                <g [attr.transform]="'translate(' + getSvgX(tec) + ',' + getSvgY(tec) + ')'" class="cursor-pointer" (click)="selectedTecnico.set(tec)">
                  @if (tec.distanciaKm <= radioActualKm()) {
                    <circle cx="0" cy="0" r="10" fill="#10b981" fill-opacity="0.3" class="animate-ping" />
                  }
                  <circle
                    cx="0" cy="0" r="5"
                    [attr.fill]="tec.distanciaKm <= radioActualKm() ? '#10b981' : '#64748b'"
                    stroke="#ffffff"
                    stroke-width="1.5"
                  />
                  <text x="8" y="4" fill="#cbd5e1" font-size="9" font-weight="500">
                    {{ tec.nombre }} ({{ tec.distanciaKm }} km)
                  </text>
                </g>
              }

              <!-- Centro: Ubicación del Cliente -->
              <g transform="translate(200, 200)">
                <circle cx="0" cy="0" r="12" fill="#0284c7" fill-opacity="0.4" class="animate-ping" />
                <circle cx="0" cy="0" r="7" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
                <text x="0" y="20" fill="#38bdf8" font-size="10" font-weight="bold" text-anchor="middle">
                  {{ clienteUbicacionNombre() }}
                </text>
              </g>
            </svg>
          </div>
        }

        <!-- Badge flotante de Estado Google Maps y Zona Delimitada -->
        <div class="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] shadow-lg">
            @if (mapsLoader.isLoaded()) {
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-slate-300 font-medium">Google Maps API: <span class="text-emerald-400 font-bold">Activo</span></span>
            } @else if (mapsLoader.isLoading()) {
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span class="text-slate-300 font-medium">Cargando Google Maps...</span>
            } @else {
              <span class="w-2 h-2 rounded-full bg-sky-400"></span>
              <span class="text-slate-300 font-medium">Radar Satelital Cúcuta</span>
            }
          </div>

          <div class="hidden md:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-sky-500/30 text-[10px] text-slate-300 shadow-lg" title="Navegación y zoom bloqueados estrictamente al perímetro metropolitano">
            <mat-icon class="text-sky-400" style="font-size: 13px; width: 13px; height: 13px;">lock</mat-icon>
            <span>Zona fija: Cúcuta y Aledaños</span>
          </div>
        </div>

        <!-- Leyenda flotante de Técnicos en Alcance -->
        <div class="absolute bottom-3 right-3 z-20 hidden sm:flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] shadow-lg">
          <span class="text-slate-400">En radio actual:</span>
          <span class="font-bold text-emerald-400">{{ tecnicosEnRango().length }} de {{ tecnicos().length }} técnicos</span>
        </div>
      </div>

      <!-- Pie del radar con controles y leyenda -->
      <div class="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-4 text-slate-400">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-sky-500 border border-white inline-block"></span>
            <span>Ubicación solicitante</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-emerald-500 border border-white inline-block"></span>
            <span>Técnicos al alcance ({{ tecnicosEnRango().length }})</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-slate-500 border border-white inline-block"></span>
            <span>Fuera de perímetro</span>
          </div>
        </div>

        <!-- Botones de simulación de broadcast -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="simularExpansionRadio()"
            class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 font-semibold transition-colors flex items-center gap-1"
            title="Incrementar radio de búsqueda perimetral +5 km"
          >
            <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">zoom_out_map</mat-icon>
            <span>+5 km</span>
          </button>
          <button
            type="button"
            (click)="reiniciarRadar()"
            class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition-colors"
            title="Reiniciar búsqueda a radio base de 10 km"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes radarSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-radar-spin {
      animation: radarSpin 4s linear infinite;
      transform-origin: 200px 200px;
    }
  `]
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
  readonly clienteMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      path: 0, // google.maps.SymbolPath.CIRCLE
      scale: 8,
      fillColor: '#0284c7',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2.5
    }
  };

  // Lista de técnicos cercanos con coordenadas reales en el área metropolitana de Cúcuta
  readonly tecnicos = signal<RadarTecnicoItem[]>([
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

  getTecnicoMarkerOptions(tec: RadarTecnicoItem): google.maps.MarkerOptions {
    const enRango = tec.distanciaKm <= this.radioActualKm();
    return {
      icon: {
        path: 0, // SymbolPath.CIRCLE
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
