import type { CategoriaServicio, EstadoOt, OtResponse } from '../models/common.models';

/**
 * Un "equipo" del cliente: la categoría de servicio que ya fue intervenida,
 * derivada de sus órdenes de trabajo.
 *
 * El backend **no expone una entidad de equipo**: no hay `EquipoController` ni
 * `/equipos`. Lo que el usuario llama "mi equipo" es, en los datos, el conjunto
 * de OTs de una misma categoría. Por eso se agrupa y se muestra la última.
 *
 * Vive en `@core` para que la web y la app móvil no dupliquen el agrupado ni el
 * formato de fecha. El **icono no está acá**: cada plataforma usa el suyo
 * (PrimeIcons en web, ionicons en móvil) a partir de `categoria`.
 */
export interface EquipoCliente {
  categoria: CategoriaServicio;
  /** Nombre legible de la categoría, listo para mostrar. */
  etiqueta: string;
  /** Cantidad de órdenes registradas para esa categoría. */
  intervenciones: number;
  ultimaOtId: string;
  codigoOt: string;
  descripcionFalla: string;
  estado: EstadoOt;
  /** Fecha de la última OT ya formateada en es-CO. */
  fecha: string;
}

const ETIQUETAS: Record<CategoriaServicio, string> = {
  AIRE_ACONDICIONADO: 'Aire acondicionado',
  REFRIGERACION: 'Refrigeración',
  LAVADORAS: 'Lavadora',
  ELECTRICIDAD: 'Instalaciones eléctricas',
  CAMARAS_VIGILANCIA: 'Cámaras de vigilancia',
};

/** Nombre legible de una categoría; si aparece una nueva, no rompe la lista. */
export function etiquetaCategoria(categoria: CategoriaServicio): string {
  return ETIQUETAS[categoria] ?? String(categoria).replace(/_/g, ' ').toLowerCase();
}

/**
 * Agrupa las OTs del cliente por categoría y deja primero la intervención más
 * reciente. Función pura: se puede testear sin Angular ni HTTP.
 */
export function agruparEquipos(ots: readonly OtResponse[]): EquipoCliente[] {
  const porCategoria = new Map<CategoriaServicio, OtResponse[]>();

  for (const ot of ots) {
    const lista = porCategoria.get(ot.categoriaServicio) ?? [];
    lista.push(ot);
    porCategoria.set(ot.categoriaServicio, lista);
  }

  return Array.from(porCategoria.entries())
    .map(([categoria, ordenes]) => {
      const ultima = [...ordenes].sort(
        (a, b) => fechaMs(b.fechaCreacion) - fechaMs(a.fechaCreacion),
      )[0];

      const equipo: EquipoCliente = {
        categoria,
        etiqueta: etiquetaCategoria(categoria),
        intervenciones: ordenes.length,
        ultimaOtId: ultima.id,
        codigoOt: ultima.codigo ?? 'Sin código',
        descripcionFalla: ultima.descripcionFalla,
        estado: ultima.estado,
        fecha: formatear(ultima.fechaCreacion),
      };

      return { ms: fechaMs(ultima.fechaCreacion), equipo };
    })
    .sort((a, b) => b.ms - a.ms)
    .map(({ equipo }) => equipo);
}

function fechaMs(fecha?: string): number {
  const ms = fecha ? Date.parse(fecha) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

function formatear(fecha?: string): string {
  const ms = fechaMs(fecha);
  if (!ms) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}
