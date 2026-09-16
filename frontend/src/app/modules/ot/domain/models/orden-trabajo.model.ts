import { ActorOt, EstadoOt } from './estado-ot.model';

export type CategoriaServicio =
  'AIRE_ACONDICIONADO' | 'REFRIGERACION' | 'ELECTRICIDAD' | 'ELECTRODOMESTICOS';

export const ETIQUETA_CATEGORIA: Record<CategoriaServicio, string> = {
  AIRE_ACONDICIONADO: 'Aire acondicionado',
  REFRIGERACION: 'Refrigeración',
  ELECTRICIDAD: 'Electricidad',
  ELECTRODOMESTICOS: 'Electrodomésticos',
};

export interface Presupuesto {
  total: number;
  detalle?: string;
}

export interface Diagnostico {
  fallaDetectada: string;
  observaciones?: string;
  costoManoObra: number;
  costoRepuestos: number;
}

export interface HistorialEstado {
  estado: EstadoOt;
  actor: ActorOt;
  fecha: string;
  motivo?: string;
}

export interface OrdenTrabajo {
  id: string;
  clienteId: string;
  clienteNombre: string;
  categoriaServicio: CategoriaServicio;
  estado: EstadoOt;
  tecnicoId: string | null;
  tecnicoNombre: string | null;
  direccion: string;
  barrio: string | null;
  descripcionFalla: string;
  creadaEn: string;
  actualizadaEn: string;
  tarifaVisita: number;
  radioKm: number;
  presupuesto: Presupuesto | null;
  diagnostico: Diagnostico | null;
  historial: HistorialEstado[];
}

export interface CrearOrdenTrabajoRequest {
  clienteId: string;
  clienteNombre: string;
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  direccion: string;
  barrio: string | null;
}

export interface DiagnosticoRequest {
  fallaDetectada: string;
  observaciones?: string;
  costoManoObra: number;
  costoRepuestos: number;
}
