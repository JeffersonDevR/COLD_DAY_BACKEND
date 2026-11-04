import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { avisarErrorAccion } from '@core/alertas/mensaje-error';
import {
  CategoriaServicio,
  DocumentoTecnico,
  TecnicoResponse,
} from '@core/models/common.models';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { cargarTecnicoAutenticado } from '@core/service/tecnico-sesion';
import { MobileToastService } from '../../core/toast.service';

const ETIQUETAS_CATEGORIA: Record<CategoriaServicio, string> = {
  CAMARAS_VIGILANCIA: 'Cámaras de vigilancia',
  REFRIGERACION: 'Refrigeración',
  AIRE_ACONDICIONADO: 'Aire acondicionado',
  LAVADORAS: 'Lavadoras',
  ELECTRICIDAD: 'Electricidad',
};

const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  CEDULA: 'Cédula',
  ANTECEDENTES: 'Antecedentes',
  ANTECEDENTES_POLICIA: 'Antecedentes de policía',
  CERTIFICACION_CONTE: 'Certificación CONTE',
  CERTIFICACION_SENA: 'Certificación SENA',
  MATRICULA_CONTE: 'Matrícula CONTE',
  RUT: 'RUT',
  OTRO: 'Otro',
};

const ORDEN_CATEGORIAS: CategoriaServicio[] = [
  'CAMARAS_VIGILANCIA',
  'REFRIGERACION',
  'AIRE_ACONDICIONADO',
  'LAVADORAS',
  'ELECTRICIDAD',
];

/** B4 — Technician profile, specialties and documents (read-only documents). */
@Component({
  selector: 'app-perfil-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonSpinner,
    IonToolbar,
  ],
  templateUrl: './perfil-tecnico.page.html',
})
export class PerfilTecnicoPage implements OnInit {
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly toast = inject(MobileToastService);

  readonly tecnico = signal<TecnicoResponse | undefined>(undefined);
  readonly documentos = signal<DocumentoTecnico[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly seleccion = signal<Set<CategoriaServicio>>(new Set());
  private readonly categoriasServidor = signal<Set<CategoriaServicio>>(new Set());

  readonly categorias = ORDEN_CATEGORIAS;
  readonly seleccionVacia = computed(() => this.seleccion().size === 0);
  readonly hayCambios = computed(() => {
    const actuales = this.seleccion();
    const base = this.categoriasServidor();
    if (actuales.size !== base.size) return true;
    for (const categoria of actuales) {
      if (!base.has(categoria)) return true;
    }
    return false;
  });

  readonly validacion = computed(() => this.tecnico()?.estadoValidacion ?? 'PENDIENTE');
  readonly motivoRechazo = computed(() => this.tecnico()?.motivoRechazoValidacion ?? null);

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
    this.tecnicosApi.getMisDocumentos().subscribe({
      next: (documentos) => this.documentos.set(documentos),
      error: () => this.documentos.set([]),
    });
  }

  etiquetaCategoria(categoria: CategoriaServicio): string {
    return ETIQUETAS_CATEGORIA[categoria];
  }

  etiquetaDocumento(tipo: string): string {
    return ETIQUETAS_DOCUMENTO[tipo] ?? tipo;
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

    const categorias = ORDEN_CATEGORIAS.filter((categoria) => this.seleccion().has(categoria));
    this.guardando.set(true);
    this.tecnicosApi.actualizarMisEspecialidades(categorias).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.tecnico.set(actualizado);
        const base = actualizado.categoriasServicio ?? actualizado.categorias ?? [];
        this.categoriasServidor.set(new Set(base));
        this.seleccion.set(new Set(base));
        void this.toast.success('Especialidades actualizadas', 'Tus especialidades quedaron guardadas.');
      },
      error: (err: Error) => {
        this.guardando.set(false);
        void avisarErrorAccion(this.toast, 'No se pudieron guardar las especialidades', err);
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

  tonoDocumento(documento: DocumentoTecnico): string {
    switch (documento.estadoValidacion) {
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
