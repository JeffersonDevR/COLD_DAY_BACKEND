import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { CategoriaServicio, Point, TipoCliente } from '../../core/models/common.models';
import { MapsApi } from '../../core/service/maps-api';
import { SugerenciaApiResponse } from '../../core/models/backend.dto';
import { CIUDAD_OPERACION, MapaConfigService } from '../../core/service/mapa-config.service';
import { SolicitudDraftService } from '../../core/service/solicitud-draft.service';
import { SelectorUbicacionMapa } from '../../shared/selector-ubicacion-mapa/selector-ubicacion-mapa';
import { esErrorPerfilClienteFaltante } from '../../core/errorStatus/perfil-cliente';

// Se reexporta para conservar la API pública previa de la página.
export { esErrorPerfilClienteFaltante };

/**
 * Copy del 409 al adquirir el perfil: el alta ya se commiteó antes (el token de
 * reemplazo no llegó), así que reintentar no ayuda. Hay que reautenticarse y el
 * borrador sigue guardado.
 */
const MENSAJE_PERFIL_CLIENTE_YA_EXISTE =
  'Tu perfil de cliente ya existe. Iniciá sesión para continuar; tu solicitud quedó guardada.';

@Component({
  selector: 'app-solicitar-servicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, SelectorUbicacionMapa],
  templateUrl: './solicitar-servicio-page.html'
})
export class SolicitarServicioPage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly mapsApi = inject(MapsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapaConfig = inject(MapaConfigService);
  private readonly draftService = inject(SolicitudDraftService);

  readonly categoriaActual = signal<CategoriaServicio>('AIRE_ACONDICIONADO');
  readonly loading = signal<boolean>(false);
  /** True cuando el backend rechaza la OT porque el usuario no tiene perfil de cliente. */
  readonly faltoPerfilCliente = signal<boolean>(false);
  /** Radio inicial de búsqueda: lo publica el backend (app.maps.radio-inicial-km). */
  readonly radioInicialKm = computed(() => this.mapaConfig.radioInicialKm());
  readonly sugerencias = signal<SugerenciaApiResponse[]>([]);
  readonly buscandoDireccion = signal<boolean>(false);
  /** Punto fijado en el mapa; `null` hasta que el usuario elige una ubicación. */
  readonly coordenadas = signal<Point | null>(null);

  readonly solicitudForm = new FormGroup({
    descripcionFalla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)]
    }),
    direccion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5)]
    }),
    // Se fijan por programa (mapa/GPS/autocomplete): la "hay ubicación" se
    // valida con `coordenadas()` y un mensaje claro, no con un required silencioso.
    latitud: new FormControl<number | null>(null),
    longitud: new FormControl<number | null>(null),
    evidenciaUrl: new FormControl('')
  });

  /**
   * Alta rápida del perfil de cliente sin salir de la solicitud: la dirección
   * ya tipeada y el punto del mapa son los datos que el backend necesita.
   */
  readonly perfilForm = new FormGroup({
    tipoCliente: new FormControl<TipoCliente>('B2C', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad: new FormControl(CIUDAD_OPERACION, { nonNullable: true, validators: [Validators.required] }),
    barrio: new FormControl('', { nonNullable: true }),
  });
  readonly tiposCliente: TipoCliente[] = ['B2C', 'B2B'];
  readonly creandoPerfil = signal<boolean>(false);
  /** Error honesto del alta rápida; el borrador y el formulario quedan intactos. */
  readonly errorCrearPerfil = signal<string | null>(null);
  /** El backend contestó 409: el perfil ya existe y la sesión en vuelo no sirve. */
  readonly perfilYaExistia = signal<boolean>(false);

  get listoParaEnviar(): boolean {
    return this.solicitudForm.valid && this.coordenadas() !== null && !this.loading();
  }

  constructor() {
    // Volver desde el alta del perfil (o un F5) no puede costar re-tipear todo.
    this.restaurarBorrador();
    this.solicitudForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.guardarBorrador());

    // El autocompletado solo se dispara con lo que ESCRIBE el usuario. Los
    // cambios programáticos de `direccion` (geocodificación directa/inversa) se
    // aplican con `emitEvent: false` para no reabrir el menú de sugerencias.
    this.solicitudForm.controls.direccion.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((valor) => {
          if ((valor ?? '').trim().length < 3) {
            this.sugerencias.set([]);
          }
        }),
        switchMap((valor) => {
          const query = (valor ?? '').trim();
          if (query.length < 3) {
            return of([]);
          }
          this.buscandoDireccion.set(true);
          const centro = this.mapaConfig.centro();
          const sesgo = this.coordenadas() ?? {
            latitud: centro.lat,
            longitud: centro.lng,
          };
          return this.mapsApi.autocompletar(query, sesgo).pipe(catchError(() => of([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.buscandoDireccion.set(false);
        this.sugerencias.set(lista);
      });
  }

  setCategoria(cat: CategoriaServicio): void {
    this.categoriaActual.set(cat);
    this.guardarBorrador();
  }

  /**
   * El usuario fijó o movió el punto en el mapa o por GPS: guardamos la
   * coordenada, la reflejamos en el formulario y resolvemos la dirección con
   * geocodificación inversa (proxy /api/maps/inversa).
   */
  alFijarEnMapa(punto: Point): void {
    this.coordenadas.set(punto);
    this.solicitudForm.patchValue({ latitud: punto.latitud, longitud: punto.longitud });
    this.persistirUbicacionCliente(punto);
    this.buscandoDireccion.set(true);
    this.mapsApi.inversa(punto.latitud, punto.longitud).subscribe({
      next: (d) => {
        this.buscandoDireccion.set(false);
        this.solicitudForm.patchValue({ direccion: d.direccionFormateada }, { emitEvent: false });
        this.guardarBorrador();
      },
      error: () => {
        this.buscandoDireccion.set(false);
        this.toast.error('Sin dirección', 'No se pudo resolver la dirección de ese punto. Escríbela a mano.');
      },
    });
  }

  seleccionarSugerencia(sugerencia: SugerenciaApiResponse): void {
    this.sugerencias.set([]);
    this.buscandoDireccion.set(true);
    this.mapsApi.geocodificar(sugerencia.descripcion).subscribe({
      next: (direccion) => {
        this.buscandoDireccion.set(false);
        this.coordenadas.set({ latitud: direccion.latitud, longitud: direccion.longitud });
        this.solicitudForm.patchValue(
          { direccion: direccion.direccionFormateada, latitud: direccion.latitud, longitud: direccion.longitud },
          { emitEvent: false },
        );
        this.guardarBorrador();
      },
      error: () => {
        this.buscandoDireccion.set(false);
        this.toast.error('Sin resultados', 'No se pudo geocodificar la dirección seleccionada.');
      },
    });
  }

  private persistirUbicacionCliente(punto: Point): void {
    this.clientesApi.actualizarUbicacion({ latitud: punto.latitud, longitud: punto.longitud }).subscribe({
      error: () => {
        // La captura de ubicación no debe bloquear la creación de la OT.
      },
    });
  }

  usarFotoDemo(): void {
    this.solicitudForm.patchValue({
      evidenciaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop'
    });
    this.toast.info('Foto cargada', 'Se adjuntó fotografía de evidencia.');
  }

  onSubmit(): void {
    if (this.solicitudForm.invalid) return;

    if (!this.coordenadas()) {
      this.toast.error('Falta la ubicación', 'Fija tu domicilio en el mapa o con tu ubicación GPS.');
      return;
    }

    this.guardarBorrador();
    this.enviarSolicitud();
  }

  setTipoCliente(tipo: TipoCliente): void {
    this.perfilForm.controls.tipoCliente.setValue(tipo);
  }

  /**
   * Alta de perfil en un solo toque: crea el perfil de cliente con la dirección
   * y el punto que ya están en la solicitud, adopta el token devuelto y
   * reintenta la MISMA OT sin pedir un solo dato de nuevo. El tap es el
   * consentimiento: nunca se crea el perfil en silencio.
   */
  crearPerfilYEnviar(): void {
    if (this.creandoPerfil() || this.loading()) return;
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    const punto = this.coordenadas();
    if (!punto) {
      this.toast.error('Falta la ubicación', 'Fija tu domicilio en el mapa o con tu ubicación GPS.');
      return;
    }

    const valor = this.perfilForm.getRawValue();
    // La tarjeta es la fuente de verdad: si se corrigió la dirección, la OT se
    // reintenta con ese valor y no con el que tenía el formulario original.
    this.solicitudForm.patchValue({ direccion: valor.calle.trim() }, { emitEvent: false });
    this.guardarBorrador();
    this.creandoPerfil.set(true);
    this.errorCrearPerfil.set(null);
    this.perfilYaExistia.set(false);

    this.clientesApi
      .crearMiPerfil({
        tipoCliente: valor.tipoCliente,
        calle: valor.calle.trim(),
        ciudad: valor.ciudad.trim(),
        barrio: valor.barrio.trim() || undefined,
        ubicacion: punto,
      })
      .subscribe({
        next: (perfil) => {
          this.creandoPerfil.set(false);
          if (!perfil.token) {
            // Backend legado: el JWT en vuelo quedó revocado. No se reintenta
            // con una sesión muerta; el borrador sigue intacto para después.
            this.errorCrearPerfil.set(
              'Creamos tu perfil, pero la sesión necesita renovarse. Iniciá sesión de nuevo y volvé a enviar la solicitud.',
            );
            return;
          }
          this.authService.adoptarToken(perfil.token);
          this.enviarSolicitud();
        },
        error: (err: Error) => {
          this.creandoPerfil.set(false);
          if (err instanceof ApiHttpError && err.status === 409) {
            // El perfil ya está commiteado: reintentar el alta repite el 409.
            // Se ofrece reautenticarse y el borrador queda intacto.
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
  irAIniciarSesion(): void {
    this.authService.logout();
  }

  /** Crea (o reintenta) la OT con el formulario y el punto actuales. */
  private enviarSolicitud(): void {
    const punto = this.coordenadas();
    if (!punto || this.loading()) return;

    this.loading.set(true);
    this.faltoPerfilCliente.set(false);
    this.sugerencias.set([]);
    const form = this.solicitudForm.getRawValue();
    const user = this.authService.currentUser();

    this.clientesApi
      .crearOt(
        {
          categoriaServicio: this.categoriaActual(),
          descripcionFalla: form.descripcionFalla ?? '',
          direccion: form.direccion ?? '',
          latitud: punto.latitud,
          longitud: punto.longitud,
          evidenciaUrls: form.evidenciaUrl ? [form.evidenciaUrl] : []
        },
        String(user?.id || 3),
        user?.nombre || 'Cliente'
      )
      .subscribe({
        next: (nuevaOt) => {
          this.loading.set(false);
          // La solicitud ya existe: el borrador cumplió su función.
          this.draftService.limpiar();
          this.toast.success('Solicitud Creada', `OT ${nuevaOt.codigo || 'Sin código'} transmitida por broadcast (${this.mapaConfig.radioInicialKm()} km)`);
          const roles = this.authService.userRoles();
          if (roles.has('TECNICO') && !roles.has('CLIENTE')) {
            this.router.navigate(['/tecnico/panel']);
          } else {
            this.router.navigate(['/cliente/ot', nuevaOt.id]);
          }
        },
        error: (err: Error) => {
          this.loading.set(false);
          if (esErrorPerfilClienteFaltante(err)) {
            // Técnico dual-role sin perfil de cliente: en vez de un toast que se
            // pierde, se ofrece el alta con los datos que ya están cargados.
            this.mostrarAltaPerfil();
            return;
          }
          avisarErrorAccion(this.toast, 'No se pudo crear la solicitud', err);
        }
      });
  }

  /** Abre la tarjeta de alta rápida con la dirección y la ciudad ya resueltas. */
  private mostrarAltaPerfil(): void {
    const form = this.solicitudForm.getRawValue();
    this.perfilForm.patchValue({
      tipoCliente: 'B2C',
      calle: form.direccion ?? '',
      ciudad: CIUDAD_OPERACION,
      barrio: '',
    });
    this.errorCrearPerfil.set(null);
    this.perfilYaExistia.set(false);
    this.faltoPerfilCliente.set(true);
  }

  /** Persiste el borrador con lo que el usuario ya cargó (form + mapa + categoría). */
  private guardarBorrador(): void {
    const form = this.solicitudForm.getRawValue();
    this.draftService.guardar({
      categoria: this.categoriaActual(),
      descripcion: form.descripcionFalla ?? '',
      direccion: form.direccion ?? '',
      coordenadas: this.coordenadas(),
      evidenciaUrl: form.evidenciaUrl ?? '',
      actualizadoEn: new Date().toISOString(),
    });
  }

  /**
   * Restaura el borrador sin reabrir el autocompletado (`emitEvent: false`):
   * el usuario retoma exactamente el formulario que dejó.
   */
  private restaurarBorrador(): void {
    const draft = this.draftService.leer();
    if (!draft) return;
    this.categoriaActual.set(draft.categoria);
    this.coordenadas.set(draft.coordenadas);
    this.solicitudForm.patchValue(
      {
        descripcionFalla: draft.descripcion,
        direccion: draft.direccion,
        latitud: draft.coordenadas?.latitud ?? null,
        longitud: draft.coordenadas?.longitud ?? null,
        evidenciaUrl: draft.evidenciaUrl,
      },
      { emitEvent: false },
    );
  }
}
