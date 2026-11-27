import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonSpinner,
  IonToolbar,
  IonRefresher,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import {
  CategoriaServicio,
  TecnicoResponse,
} from '@core/models/common.models';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { categoriaLabel, estadoValidacionLabel } from '@core/ui/labels';
import { MobileToastService } from '../../core/toast.service';
import { PerfilTecnicoEstado, perfilTecnicoCompleto } from '../../modo/perfil-tecnico-completo.guard';
import { TokenStorageService } from '@core/service/token-storage.service';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { Observable, tap } from 'rxjs';
import { ContenidoRecargaComponent, RecargarDirective } from '../../shared/recargar';

const ORDEN_CATEGORIAS: CategoriaServicio[] = [
  'CAMARAS_VIGILANCIA',
  'REFRIGERACION',
  'AIRE_ACONDICIONADO',
  'LAVADORAS',
  'ELECTRICIDAD',
];

/** B4 — Technician profile and specialties. Documents live in the Gestión tab. */
@Component({
  selector: 'app-perfil-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonRefresher,
    RecargarDirective,
    ContenidoRecargaComponent,
    IonFooter,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonInput,
    IonSpinner,
    IonToolbar,
    SkeletonComponent,
  ],
  templateUrl: './perfil-tecnico.page.html',
})
export class PerfilTecnicoPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);
  private readonly estado = inject(PerfilTecnicoEstado);
  private readonly tokens = inject(TokenStorageService);
  /** Llegó desde el gate: el perfil está incompleto y hay que terminarlo para operar. */
  readonly completando = inject(ActivatedRoute).snapshot.queryParamMap.has('completar');

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  /** Cédula tecleada; solo se pide mientras el servidor no tenga una. */
  readonly cedula = signal('');
  readonly cedulaGuardada = computed(() => (this.tecnico()?.numeroIdentificacion ?? '').trim());
  readonly pideCedula = computed(() => this.tecnico() !== undefined && this.cedulaGuardada() === '');
  readonly cedulaFalta = computed(() => this.pideCedula() && this.cedula().trim() === '');
  readonly seleccion = signal<Set<CategoriaServicio>>(new Set());
  private readonly categoriasServidor = signal<Set<CategoriaServicio>>(new Set());

  readonly categorias = ORDEN_CATEGORIAS;
  readonly seleccionVacia = computed(() => this.seleccion().size === 0);
  readonly hayCambios = computed(() => {
    const actuales = this.seleccion();
    const base = this.categoriasServidor();
    if (this.pideCedula() && this.cedula().trim() !== '') return true;
    if (actuales.size !== base.size) return true;
    for (const categoria of actuales) {
      if (!base.has(categoria)) return true;
    }
    return false;
  });

  readonly validacion = computed(() => this.tecnico()?.estadoValidacion ?? 'PENDIENTE');
  /** Etiqueta canónica del estado de validación (labels.ts), igual que la web. */
  readonly validacionLabel = computed(() => estadoValidacionLabel(this.validacion()));
  readonly motivoRechazo = computed(() => this.tecnico()?.motivoRechazoValidacion ?? null);

  /** Deslizar: la selección sin guardar no se pisa. */
  readonly recargar = (): Observable<unknown> =>
    this.tecnicosApi.getMiPerfil().pipe(
      tap((tecnico) => {
        if (!tecnico) return;
        const pendiente = this.hayCambios();
        this.tecnico.set(tecnico);
        const base = tecnico.categoriasServicio ?? tecnico.categorias ?? [];
        this.categoriasServidor.set(new Set(base));
        if (!pendiente) this.seleccion.set(new Set(base));
      }),
    );

  ngOnInit(): void {
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        this.tecnico.set(tecnico);
        this.cargando.set(false);
        if (tecnico) {
          const base = tecnico.categoriasServicio ?? tecnico.categorias ?? [];
          this.categoriasServidor.set(new Set(base));
          this.seleccion.set(new Set(base));
        }
      },
      (err) => {
        this.cargando.set(false);
        void avisarErrorAccion(this.toast, 'No pudimos cargar tu perfil', err);
      },
    );
  }

  alEscribirCedula(evento: Event): void {
    this.cedula.set(String((evento as CustomEvent<{ value?: string | null }>).detail?.value ?? ''));
  }

  etiquetaCategoria(categoria: CategoriaServicio): string {
    return categoriaLabel(categoria);
  }

  estaSeleccionada(categoria: CategoriaServicio): boolean {
    return this.seleccion().has(categoria);
  }

  toggleCategoria(categoria: CategoriaServicio): void {
    this.seleccion.update((actual) => {
      const copia = new Set(actual);
      if (copia.has(categoria)) {
        copia.delete(categoria);
      } else {
        copia.add(categoria);
      }
      return copia;
    });
  }

  guardar(): void {
    if (this.seleccionVacia() || this.cedulaFalta() || this.guardando() || !this.hayCambios()) return;

    const categorias = ORDEN_CATEGORIAS.filter((categoria) => this.seleccion().has(categoria));
    this.guardando.set(true);
    const cedula = this.pideCedula() ? this.cedula().trim() : undefined;
    this.tecnicosApi.actualizarMisEspecialidades(categorias, cedula).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.tecnico.set(actualizado);
        const base = actualizado.categoriasServicio ?? actualizado.categorias ?? [];
        this.categoriasServidor.set(new Set(base));
        this.seleccion.set(new Set(base));
        void this.toast.success('Perfil actualizado', 'Tus datos quedaron guardados.');
        if (perfilTecnicoCompleto(actualizado)) {
          this.estado.marcarCompleto(this.tokens.currentToken() ?? null);
          if (this.completando) void this.router.navigateByUrl('/tecnico/radar');
        }
      },
      error: (err: Error) => {
        this.guardando.set(false);
        void avisarErrorAccion(this.toast, 'No se pudo guardar tu perfil', err);
      },
    });
  }

  tonoValidacion(): string {
    switch (this.validacion()) {
      case 'APROBADO':
        return 'ok';
      case 'RECHAZADO':
      case 'SUSPENDIDO':
        return 'cerrada';
      default:
        return 'espera';
    }
  }
}
