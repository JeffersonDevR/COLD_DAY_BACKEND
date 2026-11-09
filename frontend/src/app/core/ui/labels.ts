import {
  CategoriaServicio,
  EstadoDisputa,
  EstadoLiquidacion,
  EstadoOperativo,
  EstadoOt,
  EstadoRequerimiento,
  EstadoValidacion,
  MedioPago,
  Rol,
  TipoDocumentoProveedor,
  TipoDocumentoTecnico,
} from '../models/common.models';

/**
 * Capa de presentación de los enums del backend.
 *
 * Los identificadores del backend son constantes (`BUSCANDO_TECNICO`), no
 * copy. Estas funciones son el único lugar donde se traducen a texto visible:
 * sentence case, sin transformar a mayúsculas (eso es una decisión de CSS y la
 * toma el `uppercase` del markup).
 */

/**
 * Falla en tiempo de compilación si aparece un miembro nuevo sin etiqueta.
 *
 * En tiempo de ejecución devuelve el identificador tal cual: los tipos son de
 * compilación, pero los datos llegan por la red. Si el backend estrena un
 * estado que la app todavía no conoce, la pantalla muestra `EN_GARANTIA` en vez
 * de romperse.
 */
function sinEtiqueta(valor: never): string {
  return String(valor);
}

export function estadoOtLabel(estado: EstadoOt): string {
  switch (estado) {
    case 'SOLICITADA': return 'Solicitada';
    case 'BUSCANDO_TECNICO': return 'Buscando técnico';
    case 'ASIGNADA': return 'Asignada';
    case 'EN_CAMINO': return 'En camino';
    case 'EN_DIAGNOSTICO': return 'En diagnóstico';
    case 'EN_REPARACION': return 'En reparación';
    case 'FINALIZADA': return 'Finalizada';
    case 'CANCELADA': return 'Cancelada';
    case 'SIN_TECNICOS_DISPONIBLES': return 'Sin técnicos disponibles';
    case 'DISPUTADA': return 'En disputa';
    default: return sinEtiqueta(estado);
  }
}

export function estadoOperativoLabel(estado: EstadoOperativo): string {
  switch (estado) {
    case 'DISPONIBLE': return 'Disponible';
    case 'OCUPADO': return 'En servicio';
    case 'FUERA_DE_SERVICIO': return 'Fuera de servicio';
    case 'BLOQUEADO_POR_LIQUIDACION': return 'Bloqueado por liquidación';
    default: return sinEtiqueta(estado);
  }
}

export function estadoValidacionLabel(estado: EstadoValidacion): string {
  switch (estado) {
    case 'PENDIENTE': return 'Pendiente';
    case 'EN_REVISION': return 'En revisión';
    case 'APROBADO': return 'Aprobado';
    case 'RECHAZADO': return 'Rechazado';
    case 'SUSPENDIDO': return 'Suspendido';
    default: return sinEtiqueta(estado);
  }
}

export function estadoLiquidacionLabel(estado: EstadoLiquidacion): string {
  switch (estado) {
    case 'PENDIENTE_CONSIGNACION': return 'Pendiente de consignación';
    case 'EN_VERIFICACION': return 'En verificación';
    case 'APROBADA': return 'Aprobada';
    case 'RECHAZADA': return 'Rechazada';
    default: return sinEtiqueta(estado);
  }
}

export function estadoDisputaLabel(estado: EstadoDisputa): string {
  switch (estado) {
    case 'ABIERTA': return 'Abierta';
    case 'RESUELTA_CON_ACUERDO': return 'Resuelta con acuerdo';
    case 'RESUELTA_SIN_ACUERDO': return 'Resuelta sin acuerdo';
    default: return sinEtiqueta(estado);
  }
}

export function estadoRequerimientoLabel(estado: EstadoRequerimiento): string {
  switch (estado) {
    case 'SOLICITADO': return 'Solicitado';
    case 'ASIGNADO': return 'Asignado';
    case 'ENTREGADO': return 'Entregado';
    case 'SIN_PROVEEDOR': return 'Sin proveedor';
    default: return sinEtiqueta(estado);
  }
}

export function categoriaLabel(categoria: CategoriaServicio): string {
  switch (categoria) {
    case 'CAMARAS_VIGILANCIA': return 'Cámaras de vigilancia';
    case 'REFRIGERACION': return 'Refrigeración';
    case 'AIRE_ACONDICIONADO': return 'Aire acondicionado';
    case 'LAVADORAS': return 'Lavadoras';
    case 'ELECTRICIDAD': return 'Electricidad';
    default: return sinEtiqueta(categoria);
  }
}

export function documentoLabel(tipo: TipoDocumentoTecnico | TipoDocumentoProveedor): string {
  switch (tipo) {
    case 'CEDULA': return 'Cédula';
    case 'ANTECEDENTES': return 'Antecedentes';
    case 'ANTECEDENTES_POLICIA': return 'Antecedentes de policía';
    case 'CERTIFICACION_CONTE': return 'Certificación CONTE';
    case 'CERTIFICACION_SENA': return 'Certificación SENA';
    case 'MATRICULA_CONTE': return 'Matrícula CONTE';
    case 'RUT': return 'RUT';
    case 'OTRO': return 'Otro';
    case 'CERTIFICADO': return 'Certificado';
    default: return sinEtiqueta(tipo);
  }
}

export function medioPagoLabel(medio: MedioPago): string {
  switch (medio) {
    case 'EFECTIVO': return 'Efectivo';
    case 'TRANSFERENCIA': return 'Transferencia';
    default: return sinEtiqueta(medio);
  }
}

export function rolLabel(rol: Rol): string {
  switch (rol) {
    case 'CLIENTE': return 'Cliente';
    case 'TECNICO': return 'Técnico';
    case 'ADMINISTRADOR': return 'Administrador';
    case 'CONTABLE': return 'Contable';
    case 'PROVEEDOR': return 'Proveedor';
    default: return sinEtiqueta(rol);
  }
}

/** Unión que consume `app-estado-badge`, que no conoce la familia del estado. */
export type EstadoBadgeValue =
  | EstadoOt
  | EstadoOperativo
  | EstadoValidacion
  | EstadoLiquidacion
  | EstadoDisputa;

/** Despacha a la familia correcta para el badge compartido. */
export function estadoBadgeLabel(estado: EstadoBadgeValue): string {
  switch (estado) {
    case 'SOLICITADA':
    case 'BUSCANDO_TECNICO':
    case 'ASIGNADA':
    case 'EN_CAMINO':
    case 'EN_DIAGNOSTICO':
    case 'EN_REPARACION':
    case 'FINALIZADA':
    case 'CANCELADA':
    case 'SIN_TECNICOS_DISPONIBLES':
    case 'DISPUTADA':
      return estadoOtLabel(estado);
    case 'DISPONIBLE':
    case 'OCUPADO':
    case 'FUERA_DE_SERVICIO':
    case 'BLOQUEADO_POR_LIQUIDACION':
      return estadoOperativoLabel(estado);
    case 'PENDIENTE':
    case 'EN_REVISION':
    case 'APROBADO':
    case 'RECHAZADO':
    case 'SUSPENDIDO':
      return estadoValidacionLabel(estado);
    case 'PENDIENTE_CONSIGNACION':
    case 'EN_VERIFICACION':
    case 'APROBADA':
    case 'RECHAZADA':
      return estadoLiquidacionLabel(estado);
    case 'ABIERTA':
    case 'RESUELTA_CON_ACUERDO':
    case 'RESUELTA_SIN_ACUERDO':
      return estadoDisputaLabel(estado);
    default:
      return sinEtiqueta(estado);
  }
}
