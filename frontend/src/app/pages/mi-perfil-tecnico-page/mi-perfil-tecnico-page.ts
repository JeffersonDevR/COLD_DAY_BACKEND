import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '../../core/service/tecnico-sesion';
import { ToastService } from '../../core/alertas/toast.service';
import { EstadoBadge } from '../../shared/estado-badge/estado-badge';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Loader } from '../../shared/loader/loader';
import { CategoriaServicio, TecnicoResponse } from '../../core/models/common.models';

/**
 * Etiquetas de las categorías. El proyecto no tiene un mapa central y cada
 * pantalla define el suyo (ver solicitar-servicio-page.html); se replica acá el
 * mismo vocabulario sin refactorizar las demás páginas.
 */
const ETIQUETAS_CATEGORIA: Record<CategoriaServicio, string> = {
  REFRIGERACION: 'Refrigeración',
  AIRE_ACONDICIONADO: 'Aire Acondicionado',
  ELECTRICIDAD: 'Electricidad',
  ELECTRODOMESTICOS: 'Electrodomésticos',
};

@Component({
  selector: 'app-mi-perfil-tecnico-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EstadoBadge, EmptyState, Loader],
  templateUrl: './mi-perfil-tecnico-page.html',
})
export class MiPerfilTecnicoPage {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(ToastService);

  /** Orden canónico de las categorías, alineado al enum del backend. */
  readonly todasLasCategorias: CategoriaServicio[] = [
    'REFRIGERACION',
    'AIRE_ACONDICIONADO',
    'ELECTRICIDAD',
    'ELECTRODOMESTICOS',
  ];

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly cargando = signal<boolean>(true);
  readonly guardando = signal<boolean>(false);

  /** Selección local de especialidades; arranca con lo que devolvió el servidor. */
  readonly seleccion = signal<Set<CategoriaServicio>>(new Set());

  /** Copia del servidor para distinguir cambios reales sin guardar. */
  private readonly categoriasServidor = signal<Set<CategoriaServicio>>(new Set());

  readonly seleccionVacia = computed(() => this.seleccion().size === 0);

  /** Solo hay cambios si la selección difiere del servidor (comparación de conjuntos). */
  readonly hayCambios = computed(() => {
    const actuales = this.seleccion();
    const base = this.categoriasServidor();
    if (actuales.size !== base.size) return true;
    for (const categoria of actuales) {
      if (!base.has(categoria)) return true;
    }
    return false;
  });

  readonly estadoValidacion = computed(() => this.tecnico()?.estadoValidacion);
  readonly motivoRechazoValidacion = computed(() => this.tecnico()?.motivoRechazoValidacion);

  constructor() {
    cargarTecnicoAutenticado(
      this.tecnicosApi,
      (tecnico) => {
        this.tecnico.set(tecnico);
        this.cargando.set(false);
        if (tecnico) {
          const base = this.categoriasDe(tecnico);
          this.categoriasServidor.set(new Set(base));
          this.seleccion.set(new Set(base));
        }
      },
      () => this.cargando.set(false),
    );
  }

  etiquetaCategoria(categoria: CategoriaServicio): string {
    return ETIQUETAS_CATEGORIA[categoria];
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
    if (this.seleccionVacia() || this.guardando() || !this.hayCambios()) return;

    // Se envía en el orden canónico para que el body sea determinista.
    const categorias = this.todasLasCategorias.filter((categoria) => this.seleccion().has(categoria));
    this.guardando.set(true);
    this.tecnicosApi.actualizarMisEspecialidades(categorias).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.tecnico.set(actualizado);
        const base = this.categoriasDe(actualizado);
        this.categoriasServidor.set(new Set(base));
        this.seleccion.set(new Set(base));
        this.toast.success('Especialidades actualizadas', 'Tus especialidades quedaron guardadas.');
      },
      error: (err: Error) => {
        this.guardando.set(false);
        // La selección local NO se descarta: el técnico corrige y reintenta.
        // Un 400 del backend (conjunto vacío) se muestra tal cual lo emitió.
        this.toast.error(
          'No se pudieron guardar las especialidades',
          err.message || 'Intenta de nuevo.',
        );
      },
    });
  }

  /** Categorías del técnico; el backend las expone en `categoriasServicio`. */
  private categoriasDe(tecnico: TecnicoResponse): CategoriaServicio[] {
    return tecnico.categoriasServicio ?? tecnico.categorias ?? [];
  }
}
