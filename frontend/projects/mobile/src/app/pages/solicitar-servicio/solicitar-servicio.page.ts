import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import { ApiHttpError } from '@core/alertas/api-http.error';
import {
  esErrorPerfilClienteFaltante,
  MENSAJE_PERFIL_CLIENTE_YA_EXISTE,
} from '@core/errorStatus/perfil-cliente';
import { CategoriaServicio, Point, TipoCliente } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ClientesApi } from '@core/service/clientes-api';
import { mensajeErrorGeolocation } from '@core/service/geolocation.service';
import { MobileGeolocationService } from '../../core/geolocation-native';
import { CIUDAD_OPERACION, MapaConfigService } from '@core/service/mapa-config.service';
import { MapsApi } from '@core/service/maps-api';
import { SolicitudDraftService } from '@core/service/solicitud-draft.service';
import { MobileToastService } from '../../core/toast.service';
import { FotoLocalComponent } from '../../shared/foto-local/foto-local';

/** Las cuatro líneas que ofrece la web; el resto del enum no se pide acá. */
const CATEGORIAS: readonly {
  valor: CategoriaServicio;
  etiqueta: string;
  subtipo: string;
  icono: string;
}[] = [
  {
    valor: 'AIRE_ACONDICIONADO',
    etiqueta: 'Aire acondicionado',
    subtipo: 'Split e inverter',
    icono: 'snow-outline',
  },
  {
    valor: 'REFRIGERACION',
    etiqueta: 'Refrigeración',
    subtipo: 'Heladeras y freezers',
    icono: 'thermometer-outline',
  },
  {
    valor: 'ELECTRICIDAD',
    etiqueta: 'Electricidad',
    subtipo: 'Tableros y tomas',
    icono: 'flash-outline',
  },
  {
    valor: 'LAVADORAS',
    etiqueta: 'Lavadoras',
    subtipo: 'Carga frontal y superior',
    icono: 'water-outline',
  },
];

/** Contrato mínimo de la Web Speech API: solo lo que usa el dictado. */
interface ResultadoVoz {
  readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }>>;
}

interface ReconocimientoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((evento: ResultadoVoz) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type ConstructorReconocimientoVoz = new () => ReconocimientoVoz;

function obtenerReconocimientoVoz(): ConstructorReconocimientoVoz | null {
  if (typeof window === 'undefined') return null;
  const ventana = window as unknown as {
    SpeechRecognition?: ConstructorReconocimientoVoz;
    webkitSpeechRecognition?: ConstructorReconocimientoVoz;
  };
  return ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
}

function extraerTranscripcion(evento: ResultadoVoz): string {
  const alternativa = evento.results[0]?.[0];
  return alternativa ? alternativa.transcript.trim() : '';
}

const TIPOS_CLIENTE: readonly { valor: TipoCliente; etiqueta: string }[] = [
  { valor: 'B2C', etiqueta: 'Persona (B2C)' },
  { valor: 'B2B', etiqueta: 'Empresa (B2B)' },
];

const MSG_FALTA_UBICACION =
  'Usá tu ubicación o ubicá la dirección antes de enviar: el técnico necesita el punto exacto.';

/**
 * A5 — Solicitar servicio (paso 1).
 *
 * Igual que la web en todo lo que importa: la misma OT, el mismo borrador y el
 * mismo alta de perfil en un toque. Diferencias forzadas por esta entrega:
 *
 * - No hay mapa interactivo: la dirección se geocodifica por el proxy del
 *   backend o se toma del GPS, y el pin en mapa llega en P3 con mapas nativos.
 * - No hay foto de evidencia: el backend es metadata-only, no existe upload.
 * - El alta del perfil vive en esta misma tarjeta (la ruta web `/perfil/agregar`
 *   no existe en móvil), así que no se ofrece "completar por separado".
 */
@Component({
  selector: 'app-mobile-solicitar-servicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
      IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    FotoLocalComponent,
  ],
  template: `
    <ion-header class="cd-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button fill="clear" aria-label="Volver" data-testid="volver" (click)="atras()">
            <ion-icon slot="icon-only" name="arrow-back-outline" aria-hidden="true"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Nueva solicitud</ion-title>
        <ion-buttons slot="end">
          <span class="cd-paso__contador" data-testid="paso-contador">
            Paso {{ paso() }} de {{ totalPasos }}
          </span>
        </ion-buttons>
      </ion-toolbar>
      <div class="cd-paso__pista" aria-hidden="true">
        @for (n of [1, 2, 3]; track n) {
          <span class="cd-paso__punto" [class.cd-paso__punto--activo]="n <= paso()"></span>
        }
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      @if (paso() === 1) {
        <header class="cd-solicitud__intro">
          <h1 class="cd-headline">¿Dónde es el servicio?</h1>
          <p class="cd-muted">
            El técnico necesita el punto exacto. La orden sale a los técnicos cercanos de Cúcuta
            ({{ radioInicialKm() }} km) y el primero que acepta la toma.
          </p>
        </header>
      }

      @if (faltoPerfilCliente()) {
        <section
          class="cd-alerta cd-alerta--aviso"
          role="alert"
          data-testid="aviso-perfil-cliente"
        >
          <h2 class="cd-alerta__titulo">Tu cuenta todavía no tiene perfil de cliente</h2>
          <p class="cd-alerta__texto">
            Podés crearlo ahora con la dirección y la ubicación que ya cargaste. Al confirmar,
            creamos el perfil y enviamos tu solicitud en el mismo paso.
          </p>

          <div [formGroup]="perfilForm" class="cd-perfil-rapido">
            <p class="cd-ayuda">Tipo de cliente</p>
            <div class="cd-chips" role="group" aria-label="Tipo de cliente">
              @for (tipo of tiposCliente; track tipo.valor) {
                <button
                  type="button"
                  class="cd-chip"
                  [class.cd-chip--activo]="perfilForm.controls.tipoCliente.value === tipo.valor"
                  [attr.aria-pressed]="perfilForm.controls.tipoCliente.value === tipo.valor"
                  [attr.data-testid]="'perfil-tipo-' + tipo.valor.toLowerCase()"
                  (click)="setTipoCliente(tipo.valor)"
                >
                  {{ tipo.etiqueta }}
                </button>
              }
            </div>

            <ion-list lines="none" class="cd-form">
              <ion-item>
                <ion-input
                  formControlName="calle"
                  label="Dirección"
                  labelPlacement="stacked"
                  data-testid="perfil-calle"
                ></ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  formControlName="ciudad"
                  label="Ciudad"
                  labelPlacement="stacked"
                  data-testid="perfil-ciudad"
                ></ion-input>
              </ion-item>
              <ion-item>
                <ion-input
                  formControlName="barrio"
                  label="Barrio (opcional)"
                  labelPlacement="stacked"
                  data-testid="perfil-barrio"
                ></ion-input>
              </ion-item>
            </ion-list>

            @if (errorCrearPerfil(); as mensaje) {
              <p class="cd-auth__error" role="alert" data-testid="error-crear-perfil">
                <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
                <span>{{ mensaje }}</span>
              </p>
            }
            @if (perfilForm.controls.calle.touched && perfilForm.controls.calle.invalid) {
              <p class="cd-field-error" data-testid="error-perfil-calle">
                Escribí la dirección del servicio.
              </p>
            }
            @if (perfilForm.controls.ciudad.touched && perfilForm.controls.ciudad.invalid) {
              <p class="cd-field-error" data-testid="error-perfil-ciudad">
                Escribí la ciudad del servicio.
              </p>
            }

            @if (perfilYaExistia()) {
              <ion-button
                size="small"
                color="secondary"
                data-testid="perfil-iniciar-sesion"
                (click)="irAIniciarSesion()"
              >
                Iniciar sesión
              </ion-button>
            } @else {
              <ion-button
                size="small"
                color="secondary"
                data-testid="crear-perfil-y-enviar"
                [disabled]="creandoPerfil() || loading()"
                (click)="crearPerfilYEnviar()"
              >
                @if (creandoPerfil()) {
                  <ion-spinner name="dots"></ion-spinner>
                } @else {
                  Crear perfil y enviar la solicitud
                }
              </ion-button>
            }
          </div>
        </section>
      }

      <form class="cd-solicitud" [formGroup]="solicitudForm" (ngSubmit)="enviar()" novalidate>
        @if (paso() === 2) {
        <fieldset class="cd-bloque">
          <legend class="cd-bloque__titulo">1. Selecciona la especialidad</legend>
          <div class="cd-categorias" role="radiogroup" aria-label="Línea de especialidad">
            @for (cat of categorias; track cat.valor) {
              <button
                type="button"
                role="radio"
                class="cd-categoria"
                [class.cd-categoria--activa]="categoria() === cat.valor"
                [attr.aria-checked]="categoria() === cat.valor"
                [attr.data-testid]="'categoria-' + cat.valor.toLowerCase()"
                (click)="setCategoria(cat.valor)"
              >
                <span class="cd-categoria__icono" aria-hidden="true">
                  <ion-icon [name]="cat.icono"></ion-icon>
                </span>
                <span class="cd-categoria__marca" aria-hidden="true"></span>
                <span class="cd-categoria__texto">
                  <span class="cd-categoria__nombre">{{ cat.etiqueta }}</span>
                  <span class="cd-categoria__subtipo">{{ cat.subtipo }}</span>
                </span>
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="cd-bloque">
          <legend class="cd-bloque__titulo">2. Describe la falla o ruido extraño</legend>

          <div class="cd-bloque__accion">
            <ion-button
              size="small"
              fill="outline"
              type="button"
              data-testid="dictar-falla"
              [disabled]="!dictadoDisponible()"
              (click)="dictarFalla()"
            >
              <ion-icon slot="start" name="mic-outline" aria-hidden="true"></ion-icon>
              {{ dictando() ? 'Escuchando…' : 'Dictar por voz' }}
            </ion-button>
          </div>

          <ion-list lines="none" class="cd-form">
            <ion-item>
              <ion-textarea
                formControlName="descripcionFalla"
                label="Descripción"
                labelPlacement="stacked"
                placeholder="Ej. El aire no enfría, el compresor arranca y se apaga a los 30 segundos, gotea agua hacia la pared..."
                [autoGrow]="true"
                data-testid="descripcion"
              ></ion-textarea>
            </ion-item>
          </ion-list>
          @if (mensajeCampo('descripcionFalla'); as error) {
            <p class="cd-field-error" data-testid="error-descripcion">{{ error }}</p>
          }
        </fieldset>

        <section class="cd-bloque">
          <app-foto-local />
        </section>
        }

        @if (paso() === 1) {
        <fieldset class="cd-bloque">
          <legend class="cd-bloque__titulo">3. Dónde es el servicio</legend>
          <ion-list lines="none" class="cd-form">
            <ion-item>
              <ion-input
                formControlName="direccion"
                label="Dirección exacta"
                labelPlacement="stacked"
                autocomplete="address-line1"
                data-testid="direccion"
              ></ion-input>
            </ion-item>
          </ion-list>
          @if (mensajeCampo('direccion'); as error) {
            <p class="cd-field-error" data-testid="error-direccion">{{ error }}</p>
          }

          <div class="cd-ubicacion__acciones">
            <ion-button
              size="small"
              fill="outline"
              data-testid="geocodificar"
              [disabled]="geocodificando() || ubicando()"
              (click)="geocodificar()"
            >
              @if (geocodificando()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                <ion-icon slot="start" name="search-outline" aria-hidden="true"></ion-icon>
                Ubicar dirección
              }
            </ion-button>
            <ion-button
              size="small"
              fill="outline"
              color="tertiary"
              data-testid="usar-ubicacion"
              [disabled]="geocodificando() || ubicando()"
              (click)="usarMiUbicacion()"
            >
              @if (ubicando()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                <ion-icon slot="start" name="navigate-outline" aria-hidden="true"></ion-icon>
                Usar mi ubicación
              }
            </ion-button>
          </div>

          <p class="cd-ayuda">
            El técnico necesita el punto exacto: ubicá la dirección o compartí tu ubicación
            actual.
          </p>

          @if (coordenadas()) {
            <div class="cd-ubicacion-confirmada" data-testid="ubicacion-confirmada">
              <ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>
              <div class="cd-ubicacion-confirmada__datos">
                <p class="cd-ubicacion-confirmada__titulo">Ubicación confirmada</p>
                <p class="cd-ubicacion-confirmada__texto">
                  {{ solicitudForm.controls.direccion.value }}
                </p>
                <p class="cd-ubicacion-confirmada__coords" data-testid="coordenadas">
                  {{ textoCoordenadas() }}
                </p>
              </div>
            </div>
          } @else {
            <p class="cd-ayuda">Todavía no fijaste el punto exacto del servicio.</p>
          }
        </fieldset>
        }

        @if (paso() === 3) {
          <section class="cd-card cd-resumen" data-testid="resumen-solicitud">
            <p class="cd-eyebrow">Revisá tu solicitud</p>

            <div class="cd-resumen__fila">
              <div>
                <span class="cd-resumen__rotulo">Especialidad</span>
                <p class="cd-resumen__valor" data-testid="resumen-especialidad">
                  {{ etiquetaCategoria() }}
                </p>
              </div>
              <button type="button" class="cd-resumen__editar" (click)="irAPaso(2)">
                Editar
              </button>
            </div>

            <div class="cd-resumen__fila">
              <div>
                <span class="cd-resumen__rotulo">Falla</span>
                <p class="cd-resumen__valor" data-testid="resumen-descripcion">
                  {{ solicitudForm.controls.descripcionFalla.value }}
                </p>
              </div>
              <button type="button" class="cd-resumen__editar" (click)="irAPaso(2)">
                Editar
              </button>
            </div>

            <div class="cd-resumen__fila">
              <div>
                <span class="cd-resumen__rotulo">Ubicación</span>
                <p class="cd-resumen__valor" data-testid="resumen-direccion">
                  {{ solicitudForm.controls.direccion.value }}
                </p>
                <p class="cd-resumen__coords">{{ textoCoordenadas() }}</p>
              </div>
              <button type="button" class="cd-resumen__editar" (click)="irAPaso(1)">
                Editar
              </button>
            </div>
          </section>

          <p class="cd-ayuda">
            Al solicitar, tu orden pasa a <strong>buscando técnico</strong> y se envía a los
            técnicos cercanos: el primero que acepta la toma.
          </p>
        }
      </form>
    </ion-content>

    <ion-footer class="cd-footer">
      @if (paso() < 3) {
        <ion-button
          expand="block"
          class="cd-cta"
          type="button"
          data-testid="continuar-paso"
          [disabled]="paso() === 1 ? !puedeContinuarPaso1() : !puedeContinuarPaso2()"
          (click)="avanzar()"
        >
          {{ paso() === 1 ? 'Continuar' : 'Continuar a revisión' }}
        </ion-button>
      } @else {
        <ion-button
          expand="block"
          class="cd-cta"
          type="button"
          data-testid="enviar"
          [attr.aria-busy]="loading()"
          [disabled]="!listoParaEnviar()"
          (click)="enviar()"
        >
          @if (loading()) {
            <ion-spinner name="dots" aria-hidden="true"></ion-spinner>
            <span class="cd-cta__loading">Procesando…</span>
          } @else {
            <ion-icon slot="start" name="compass-outline" aria-hidden="true"></ion-icon>
            Solicitar técnico
          }
        </ion-button>
      }
    </ion-footer>
  `,
})
export class SolicitarServicioPage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly auth = inject(AuthService);
  private readonly mapsApi = inject(MapsApi);
  private readonly geolocation = inject(MobileGeolocationService);
  private readonly mapaConfig = inject(MapaConfigService);
  private readonly draftService = inject(SolicitudDraftService);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);

  protected readonly categorias = CATEGORIAS;
  protected readonly tiposCliente = TIPOS_CLIENTE;
  protected readonly radioInicialKm = computed(() => this.mapaConfig.radioInicialKm());

  protected readonly categoria = signal<CategoriaServicio>('AIRE_ACONDICIONADO');
  /** Punto del servicio; `null` hasta que el GPS o la geocodificación lo fijen. */
  protected readonly coordenadas = signal<Point | null>(null);

  protected readonly loading = signal(false);
  protected readonly geocodificando = signal(false);
  protected readonly ubicando = signal(false);
  protected readonly dictando = signal(false);

  /** Pasos del flujo: 1 ubicación, 2 especialidad y falla, 3 revisión. */
  protected readonly paso = signal<1 | 2 | 3>(1);
  protected readonly totalPasos = 3;

  /** El backend rechaza la OT porque el usuario todavía no tiene perfil de cliente. */
  protected readonly faltoPerfilCliente = signal(false);
  protected readonly creandoPerfil = signal(false);
  protected readonly errorCrearPerfil = signal<string | null>(null);
  protected readonly perfilYaExistia = signal(false);

  protected readonly solicitudForm = new FormGroup({
    descripcionFalla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)],
    }),
    direccion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5)],
    }),
  });

  /**
   * Alta rápida del perfil: la dirección y el punto que ya están en la
   * solicitud son los datos que el backend necesita.
   */
  protected readonly perfilForm = new FormGroup({
    tipoCliente: new FormControl<TipoCliente>('B2C', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad: new FormControl(CIUDAD_OPERACION, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    barrio: new FormControl('', { nonNullable: true }),
  });

  protected listoParaEnviar(): boolean {
    return (
      this.solicitudForm.valid &&
      this.coordenadas() !== null &&
      !this.loading() &&
      !this.creandoPerfil()
    );
  }

  /** Paso 1 exige dirección válida y punto fijado; el resto lo valida el submit. */
  protected puedeContinuarPaso1(): boolean {
    return this.solicitudForm.controls.direccion.valid && this.coordenadas() !== null;
  }

  protected puedeContinuarPaso2(): boolean {
    return this.solicitudForm.controls.descripcionFalla.valid;
  }

  protected avanzar(): void {
    if (this.paso() === 1) {
      this.solicitudForm.controls.direccion.markAsTouched();
      if (!this.puedeContinuarPaso1()) return;
      this.paso.set(2);
      return;
    }
    if (this.paso() === 2) {
      this.solicitudForm.controls.descripcionFalla.markAsTouched();
      if (!this.puedeContinuarPaso2()) return;
      this.paso.set(3);
    }
  }

  protected irAPaso(paso: 1 | 2 | 3): void {
    this.paso.set(paso);
  }

  /** Atrás: retrocede un paso; en el primero sale de la solicitud. */
  protected atras(): void {
    if (this.paso() > 1) {
      this.paso.update((actual) => (actual - 1) as 1 | 2 | 3);
      return;
    }
    void this.router.navigateByUrl('/cliente/panel');
  }

  /** Etiqueta completa de la especialidad elegida, para el resumen del paso 3. */
  protected etiquetaCategoria(): string {
    const categoria = this.categorias.find((c) => c.valor === this.categoria());
    return categoria ? `${categoria.etiqueta} · ${categoria.subtipo}` : '';
  }

  constructor() {
    // La configuración del mapa (centro, radio) la publica el backend; sin
    // respuesta se sigue con el respaldo del servicio.
    void this.mapaConfig.cargar();

    this.restaurarBorrador();
    this.solicitudForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.guardarBorrador());
  }

  protected setCategoria(categoria: CategoriaServicio): void {
    this.categoria.set(categoria);
    this.guardarBorrador();
  }

  /** El dictado usa la Web Speech API del WebView; si no existe, el botón se deshabilita. */
  protected readonly dictadoDisponible = signal(obtenerReconocimientoVoz() !== null);

  private reconocimiento: ReconocimientoVoz | null = null;

  protected dictarFalla(): void {
    const Ctor = obtenerReconocimientoVoz();
    if (!Ctor) return;
    if (this.dictando()) {
      this.reconocimiento?.stop();
      this.dictando.set(false);
      return;
    }

    const reconocimiento = new Ctor();
    reconocimiento.lang = 'es-CO';
    reconocimiento.interimResults = false;
    reconocimiento.continuous = false;
    reconocimiento.onresult = (evento) => {
      const texto = extraerTranscripcion(evento);
      if (!texto) return;
      const actual = this.solicitudForm.controls.descripcionFalla.value;
      const siguiente = actual ? `${actual.trim()} ${texto}`.trim() : texto;
      this.solicitudForm.controls.descripcionFalla.setValue(siguiente);
      this.solicitudForm.controls.descripcionFalla.markAsTouched();
      this.guardarBorrador();
    };
    reconocimiento.onerror = () => {
      this.dictando.set(false);
      void this.toast.error('No pudimos dictar', 'Probá de nuevo o escribí la falla.');
    };
    reconocimiento.onend = () => this.dictando.set(false);

    this.reconocimiento = reconocimiento;
    this.dictando.set(true);
    reconocimiento.start();
  }

  protected setTipoCliente(tipo: TipoCliente): void {
    this.perfilForm.controls.tipoCliente.setValue(tipo);
  }

  protected mensajeCampo(campo: 'descripcionFalla' | 'direccion'): string | null {
    const control = this.solicitudForm.controls[campo];
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) {
      return campo === 'direccion'
        ? 'Escribí la dirección del servicio.'
        : 'Contanos qué está fallando.';
    }
    return campo === 'direccion'
      ? 'La dirección necesita al menos 5 caracteres.'
      : 'Describí la falla con al menos 10 caracteres.';
  }

  protected textoCoordenadas(): string {
    const punto = this.coordenadas();
    if (!punto) return 'Sin ubicación todavía: el envío queda bloqueado hasta que la fijes.';
    return `Latitud ${punto.latitud.toFixed(4)} · Longitud ${punto.longitud.toFixed(4)}`;
  }

  /** Geocodifica la dirección escrita (proxy del backend) y fija el punto. */
  protected geocodificar(): void {
    const direccion = this.solicitudForm.controls.direccion.value.trim();
    if (direccion.length < 5) {
      this.solicitudForm.controls.direccion.markAsTouched();
      void this.toast.info(
        'Falta la dirección',
        'Escribí la dirección completa y volvé a intentar.',
      );
      return;
    }

    this.geocodificando.set(true);
    this.mapsApi.geocodificar(direccion).subscribe({
      next: (resultado) => {
        this.geocodificando.set(false);
        this.fijarCoordenadas({ latitud: resultado.latitud, longitud: resultado.longitud });
        const formateada = resultado.direccionFormateada?.trim();
        if (formateada) {
          this.solicitudForm.controls.direccion.setValue(formateada, { emitEvent: false });
        }
        this.guardarBorrador();
      },
      error: () => {
        this.geocodificando.set(false);
        void this.toast.error(
          'Sin resultados',
          'No pudimos ubicar esa dirección. Probá con otra o usá tu ubicación.',
        );
      },
    });
  }

  /** Toma la posición del dispositivo y resuelve la dirección por geocodificación inversa. */
  protected usarMiUbicacion(): void {
    if (this.ubicando()) return;

    this.ubicando.set(true);
    this.geolocation.obtenerPosicion().subscribe({
      next: (punto) => {
        this.ubicando.set(false);
        this.fijarCoordenadas(punto);
        this.resolverDireccion(punto);
      },
      error: (err: unknown) => {
        this.ubicando.set(false);
        void this.toast.error('Sin ubicación', mensajeErrorGeolocation(err));
      },
    });
  }

  protected enviar(): void {
    if (this.loading() || this.creandoPerfil()) return;
    if (this.solicitudForm.invalid) {
      this.solicitudForm.markAllAsTouched();
      return;
    }
    if (!this.coordenadas()) {
      void this.toast.error('Falta la ubicación', MSG_FALTA_UBICACION);
      return;
    }

    this.guardarBorrador();
    this.enviarSolicitud();
  }

  /**
   * Alta de perfil en un solo toque: crea el perfil con los datos de la
   * solicitud, adopta el token devuelto y reintenta la MISMA OT sin pedir un
   * dato de nuevo. El toque es el consentimiento: nada se crea en silencio.
   */
  protected crearPerfilYEnviar(): void {
    if (this.creandoPerfil() || this.loading()) return;
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    const punto = this.coordenadas();
    if (!punto) {
      void this.toast.error('Falta la ubicación', MSG_FALTA_UBICACION);
      return;
    }

    const datos = this.perfilForm.getRawValue();
    // La tarjeta es la fuente de verdad: si se corrigió la dirección, la OT se
    // reintenta con ese valor y no con el que tenía el formulario original.
    this.solicitudForm.controls.direccion.setValue(datos.calle.trim(), { emitEvent: false });
    this.guardarBorrador();
    this.creandoPerfil.set(true);
    this.errorCrearPerfil.set(null);
    this.perfilYaExistia.set(false);

    this.clientesApi
      .crearMiPerfil({
        tipoCliente: datos.tipoCliente,
        calle: datos.calle.trim(),
        ciudad: datos.ciudad.trim(),
        barrio: datos.barrio.trim() || undefined,
        ubicacion: punto,
      })
      .subscribe({
        next: (perfil) => {
          this.creandoPerfil.set(false);
          if (!perfil.token) {
            // Backend legado: el JWT en vuelo quedó revocado y no se reintenta
            // con una sesión muerta. El borrador sigue intacto.
            this.errorCrearPerfil.set(
              'Creamos tu perfil, pero la sesión necesita renovarse. Iniciá sesión de nuevo y volvé a enviar la solicitud.',
            );
            return;
          }
          this.auth.adoptarToken(perfil.token);
          this.enviarSolicitud();
        },
        error: (err: unknown) => {
          this.creandoPerfil.set(false);
          if (err instanceof ApiHttpError && err.status === 409) {
            // El perfil ya está commiteado: reintentar el alta repite el 409.
            this.perfilYaExistia.set(true);
            this.errorCrearPerfil.set(MENSAJE_PERFIL_CLIENTE_YA_EXISTE);
            return;
          }
          this.errorCrearPerfil.set(
            'No pudimos crear tu perfil de cliente. Tus datos siguen acá; probá de nuevo.',
          );
        },
      });
  }

  /** Cierra la sesión revocada y aterriza en el login para reautenticarse. */
  protected irAIniciarSesion(): void {
    this.auth.logout();
  }

  /** Crea (o reintenta) la OT con el formulario y el punto actuales. */
  private enviarSolicitud(): void {
    const punto = this.coordenadas();
    if (!punto || this.loading()) return;

    this.loading.set(true);
    this.faltoPerfilCliente.set(false);
    const formulario = this.solicitudForm.getRawValue();
    const usuario = this.auth.currentUser();

    // `crearOt` normaliza el body a `OtApiRequest` con `aOtApiRequest`: el
    // barrio, la marca y el modelo no viajan al backend, igual que en la web.
    this.clientesApi
      .crearOt(
        {
          categoriaServicio: this.categoria(),
          descripcionFalla: formulario.descripcionFalla.trim(),
          direccion: formulario.direccion.trim(),
          latitud: punto.latitud,
          longitud: punto.longitud,
        },
        String(usuario?.id ?? ''),
        usuario?.nombre || 'Cliente',
      )
      .subscribe({
        next: (nuevaOt) => {
          this.loading.set(false);
          // La solicitud ya existe: el borrador cumplió su función.
          this.draftService.limpiar();
          void this.toast.success(
            'Solicitud creada',
            `OT ${nuevaOt.codigo || 'Sin código'} transmitida por broadcast (${this.radioInicialKm()} km)`,
          );
          // A6: el cliente aterriza en el seguimiento de la OT que acaba de crear.
          void this.router.navigateByUrl(`/cliente/ot/${nuevaOt.id}`);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (esErrorPerfilClienteFaltante(err)) {
            // Técnico dual-role sin perfil de cliente: en vez de un toast que se
            // pierde, se ofrece el alta con los datos que ya están cargados.
            this.mostrarAltaPerfil();
            return;
          }
          avisarErrorAccion(this.toast, 'No pudimos crear la solicitud', err);
        },
      });
  }

  /** Abre la tarjeta de alta rápida con la dirección y la ciudad ya resueltas. */
  private mostrarAltaPerfil(): void {
    const formulario = this.solicitudForm.getRawValue();
    this.perfilForm.patchValue({
      tipoCliente: 'B2C',
      calle: formulario.direccion,
      ciudad: CIUDAD_OPERACION,
      barrio: '',
    });
    this.errorCrearPerfil.set(null);
    this.perfilYaExistia.set(false);
    this.faltoPerfilCliente.set(true);
  }

  /**
   * Fija el punto del servicio: lo guarda para el envío, lo refleja en el texto
   * de coordenadas y avisa la ubicación al backend (sin bloquear si falla).
   */
  private fijarCoordenadas(punto: Point): void {
    this.coordenadas.set(punto);
    this.clientesApi.actualizarUbicacion({ latitud: punto.latitud, longitud: punto.longitud }).subscribe({
      error: () => {
        // La captura de ubicación no debe bloquear la creación de la OT.
      },
    });
    this.guardarBorrador();
  }

  /** Completa la dirección a partir del punto (geocodificación inversa). */
  private resolverDireccion(punto: Point): void {
    this.mapsApi.inversa(punto.latitud, punto.longitud).subscribe({
      next: (direccion) => {
        const formateada = direccion.direccionFormateada?.trim();
        if (formateada) {
          this.solicitudForm.controls.direccion.setValue(formateada, { emitEvent: false });
        }
        this.guardarBorrador();
      },
      error: () => {
        void this.toast.error(
          'Sin dirección',
          'No pudimos resolver la dirección de ese punto. Escribila a mano.',
        );
      },
    });
  }

  /** Persiste el borrador con lo que el usuario ya cargó (form + punto + categoría). */
  private guardarBorrador(): void {
    const formulario = this.solicitudForm.getRawValue();
    this.draftService.guardar({
      categoria: this.categoria(),
      descripcion: formulario.descripcionFalla,
      direccion: formulario.direccion,
      coordenadas: this.coordenadas(),
      // Sin foto de evidencia en esta entrega (el backend no tiene upload).
      evidenciaUrl: '',
      actualizadoEn: new Date().toISOString(),
    });
  }

  /**
   * Restaura el borrador sin reabrir validaciones a medio llenar: el usuario
   * retoma exactamente el formulario que dejó.
   */
  private restaurarBorrador(): void {
    const borrador = this.draftService.leer();
    if (!borrador) return;

    this.categoria.set(borrador.categoria);
    this.coordenadas.set(borrador.coordenadas);
    this.solicitudForm.patchValue(
      {
        descripcionFalla: borrador.descripcion,
        direccion: borrador.direccion,
      },
      { emitEvent: false },
    );
  }
}
