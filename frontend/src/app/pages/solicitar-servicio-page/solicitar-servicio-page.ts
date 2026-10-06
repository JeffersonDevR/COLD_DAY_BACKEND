import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, of, switchMap, tap } from 'rxjs';
import { ClientesApi } from '../../core/service/clientes-api';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { CategoriaServicio, Point } from '../../core/models/common.models';
import { MapsApi } from '../../core/service/maps-api';
import { GeolocationService } from '../../core/service/geolocation.service';
import { SugerenciaApiResponse } from '../../core/models/backend.dto';

interface BarrioCucuta {
  nombre: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-solicitar-servicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './solicitar-servicio-page.html'
})
export class SolicitarServicioPage {
  private readonly clientesApi = inject(ClientesApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly mapsApi = inject(MapsApi);
  private readonly geolocation = inject(GeolocationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categoriaActual = signal<CategoriaServicio>('AIRE_ACONDICIONADO');
  readonly barrioSeleccionado = signal<string>('Los Caobos');
  readonly loading = signal<boolean>(false);
  readonly sugerencias = signal<SugerenciaApiResponse[]>([]);
  readonly buscandoDireccion = signal<boolean>(false);
  readonly ubicando = signal<boolean>(false);

  readonly barrios: BarrioCucuta[] = [
    { nombre: 'Los Caobos', lat: 7.8872, lng: -72.4951 },
    { nombre: 'La Riviera', lat: 7.8911, lng: -72.4933 },
    { nombre: 'Guaimaral', lat: 7.9045, lng: -72.4977 },
    { nombre: 'Prados del Este', lat: 7.8722, lng: -72.4811 },
    { nombre: 'Centro', lat: 7.8928, lng: -72.5052 },
    { nombre: 'Quinta Oriental', lat: 7.8971, lng: -72.4915 }
  ];

  readonly solicitudForm = new FormGroup({
    descripcionFalla: new FormControl('El aire mini-split inverter no enfría, se escucha un zumbido y gotea agua en la unidad interior.', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)]
    }),
    direccion: new FormControl('Calle 14 # 2E-30, Los Caobos', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    latitud: new FormControl(7.8872, { nonNullable: true }),
    longitud: new FormControl(-72.4951, { nonNullable: true }),
    evidenciaUrl: new FormControl('')
  });

  constructor() {
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
          return this.mapsApi
            .autocompletar(query, { latitud: 7.8872, longitud: -72.4951 })
            .pipe(catchError(() => of([])));
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

  seleccionarSugerencia(sugerencia: SugerenciaApiResponse): void {
    this.sugerencias.set([]);
    this.buscandoDireccion.set(true);
    this.mapsApi.geocodificar(sugerencia.descripcion).subscribe({
      next: (direccion) => {
        this.buscandoDireccion.set(false);
        this.solicitudForm.patchValue({
          direccion: direccion.direccionFormateada,
          latitud: direccion.latitud,
          longitud: direccion.longitud,
        });
        this.barrioSeleccionado.set('');
      },
      error: () => {
        this.buscandoDireccion.set(false);
        this.toast.error('Sin resultados', 'No se pudo geocodificar la dirección seleccionada.');
      },
    });
  }

  usarMiUbicacion(): void {
    if (!this.geolocation.disponible) {
      this.toast.error('No disponible', 'Tu navegador no soporta geolocalización.');
      return;
    }
    this.ubicando.set(true);
    this.geolocation
      .obtenerPosicion()
      .pipe(
        switchMap((punto) =>
          forkJoin({
            punto: of(punto),
            direccion: this.mapsApi
              .inversa(punto.latitud, punto.longitud)
              .pipe(catchError(() => of(null))),
          }),
        ),
      )
      .subscribe({
        next: ({ punto, direccion }) => {
          this.ubicando.set(false);
          this.solicitudForm.patchValue({
            direccion: direccion?.direccionFormateada ?? this.solicitudForm.controls.direccion.value,
            latitud: punto.latitud,
            longitud: punto.longitud,
          });
          this.barrioSeleccionado.set('');
          this.persistirUbicacionCliente(punto);
          this.toast.success('Ubicación capturada', 'Se usó la ubicación GPS de tu dispositivo.');
        },
        error: (err: Error) => {
          this.ubicando.set(false);
          this.toast.error('Ubicación no disponible', err.message);
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

  seleccionarBarrio(b: BarrioCucuta): void {
    this.barrioSeleccionado.set(b.nombre);
    this.solicitudForm.patchValue({
      direccion: `Barrio ${b.nombre}, Cúcuta`,
      latitud: b.lat,
      longitud: b.lng
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

    this.loading.set(true);
    const form = this.solicitudForm.getRawValue();
    const user = this.authService.currentUser();

    this.clientesApi.crearOt(
      {
        categoriaServicio: this.categoriaActual(),
        descripcionFalla: form.descripcionFalla,
        direccion: form.direccion,
        barrio: this.barrioSeleccionado(),
        latitud: form.latitud,
        longitud: form.longitud,
        evidenciaUrls: form.evidenciaUrl ? [form.evidenciaUrl] : []
      },
      String(user?.id || 3),
      user?.nombre || 'Cliente'
    ).subscribe({
      next: (nuevaOt) => {
        this.loading.set(false);
        this.toast.success('Solicitud Creada', `OT ${nuevaOt.id} transmitida por broadcast (10 km)`);
        this.router.navigate(['/cliente/ot', nuevaOt.id]);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.toast.error('No se pudo crear la solicitud', err.message || 'Intenta de nuevo.');
      }
    });
  }
}
