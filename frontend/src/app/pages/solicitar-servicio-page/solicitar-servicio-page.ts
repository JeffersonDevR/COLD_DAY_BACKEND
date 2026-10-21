import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { CategoriaServicio, Point } from '../../core/models/common.models';
import { MapsApi } from '../../core/service/maps-api';
import { SugerenciaApiResponse } from '../../core/models/backend.dto';
import { MapaConfigService } from '../../core/service/mapa-config.service';
import { SelectorUbicacionMapa } from '../../shared/selector-ubicacion-mapa/selector-ubicacion-mapa';

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

  readonly categoriaActual = signal<CategoriaServicio>('AIRE_ACONDICIONADO');
  readonly loading = signal<boolean>(false);
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

  get listoParaEnviar(): boolean {
    return this.solicitudForm.valid && this.coordenadas() !== null && !this.loading();
  }

  constructor() {
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

    const punto = this.coordenadas();
    if (!punto) {
      this.toast.error('Falta la ubicación', 'Fija tu domicilio en el mapa o con tu ubicación GPS.');
      return;
    }

    this.loading.set(true);
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
          this.toast.error('No se pudo crear la solicitud', err.message || 'Intenta de nuevo.');
        }
      });
  }
}
