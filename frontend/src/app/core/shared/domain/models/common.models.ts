/** Roles soportados por el backend (Rol.java). */
export type Rol = 'CLIENTE' | 'TECNICO' | 'ADMINISTRADOR' | 'CONTABLE';

export type CategoriaServicio =
  | 'REFRIGERACION'
  | 'AIRE_ACONDICIONADO'
  | 'ELECTRICIDAD'
  | 'ELECTRODOMESTICOS';

/** Tipo de cliente del backend (TipoCliente.java). */
export type TipoCliente = 'B2B' | 'B2C';

export type EstadoValidacion = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'SUSPENDIDO';

/** Estados operativos del backend (EstadoOperativo.java). */
export type EstadoOperativo =
  | 'DISPONIBLE'
  | 'OCUPADO'
  | 'FUERA_DE_SERVICIO'
  | 'BLOQUEADO_POR_LIQUIDACION';

export type EstadoOt =
  | 'SOLICITADA'
  | 'BUSCANDO_TECNICO'
  | 'ASIGNADA'
  | 'EN_CAMINO'
  | 'EN_DIAGNOSTICO'
  | 'EN_REPARACION'
  | 'FINALIZADA'
  | 'CANCELADA'
  | 'SIN_TECNICOS_DISPONIBLES'
  | 'DISPUTADA';

export type OfertaEstado = 'PENDIENTE' | 'ACEPTADA' | 'EXPIRADA' | 'CANCELADA';

export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA';

/** Estados de liquidación del backend (EstadoLiquidacion.java). */
export type EstadoLiquidacion =
  | 'PENDIENTE_CONSIGNACION'
  | 'EN_VERIFICACION'
  | 'APROBADA'
  | 'RECHAZADA';

/** Estados de disputa del backend (EstadoDisputa.java). */
export type EstadoDisputa = 'ABIERTA' | 'RESUELTA_CON_ACUERDO' | 'RESUELTA_SIN_ACUERDO';

export type ActorOt = 'CLIENTE' | 'TECNICO' | 'ADMINISTRADOR' | 'SISTEMA';

export interface Certificacion {
  id?: string;
  nombre: string;
  institucion?: string;
  numeroRegistro?: string;
  fechaObtencion?: string;
  fechaVencimiento?: string;
  documentoUrl?: string;
  estadoVigencia?: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
}

/**
 * Tipos de documento conocidos. El backend serializa `tipo` como string libre,
 * por eso se mantiene abierto a nuevos valores vía el cast en `backend.mappers`.
 */
export type TipoDocumentoTecnico =
  | 'CEDULA'
  | 'ANTECEDENTES'
  | 'ANTECEDENTES_POLICIA'
  | 'CERTIFICACION_CONTE'
  | 'CERTIFICACION_SENA'
  | 'MATRICULA_CONTE'
  | 'RUT'
  | 'OTRO';
export type DocumentoTecnicoResponse = DocumentoTecnico;

export interface DocumentoTecnico {
  id: string;
  tipo: TipoDocumentoTecnico;
  nombre: string;
  archivoUrl?: string;
  fechaVencimiento?: string;
  estadoValidacion: EstadoValidacion;
  observaciones?: string;
  semaforo?: 'VERDE' | 'AMARILLO' | 'ROJO';
}

export interface Point {
  latitud: number;
  longitud: number;
}

/** Fuente de la distancia usada en la tarifa de visita (TarifaFuente.java). */
export type TarifaFuente = 'ROAD' | 'LINEAL';

/**
 * Estimacion de tarifa de visita (POST /api/ot/tarifa/estimar). Es solo lectura:
 * no crea ni modifica una OT. Fuera de rango devuelve `banda` y `tarifa` en
 * `null` explicito, nunca un centinela.
 */
export interface TarifaEstimadaResponse {
  distanciaKm: number;
  tarifaFuente: TarifaFuente;
  banda: number | null;
  tarifa: number | null;
  fueraDeRango: boolean;
}

/**
 * Error canónico del backend (ApiError.java): {status, message, fieldErrors}.
 * Los handlers de seguridad y el de Maps devuelven un ARRAY con un solo ApiError.
 */
export interface ApiError {
  status: number;
  message: string;
  fieldErrors?: string[];
}

export interface UsuarioRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  fotoUrl?: string;
  rol: Rol;
  aceptaHabeasData: boolean;
}

export interface UsuarioResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono?: string;
  fotoUrl?: string;
  rol: Rol;
  fechaRegistro?: string;
  habeasDataAceptado: boolean;
  activo: boolean;
  token?: string;
}

/**
 * Respuesta real de POST /api/usuarios/login (TokenResponse.java del backend).
 * El backend NO devuelve el perfil del usuario; solo el token, su expiración y el rol.
 * El perfil se reconstruye a partir de los claims del JWT (sub = usuarioId, rol).
 */
export interface TokenResponse {
  token: string;
  expiracion: string;
  rol: Rol;
  /**
   * Solo lo rellena el MOCK local. El backend real NO devuelve el perfil en el
   * login; en ese caso se reconstruye desde los claims del JWT (sub = usuarioId, rol).
   */
  usuario?: UsuarioResponse;
}

export interface TecnicoRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  numeroIdentificacion: string;
  fotoUrl?: string;
  categoriasServicio: CategoriaServicio[];
  certificaciones?: Certificacion[];
  aceptaHabeasData: boolean;
}

export interface TecnicoResponse {
  id: string;
  usuarioId?: number;
  nombre: string;
  nombreCompleto?: string;
  cedula?: string;
  correo: string;
  telefono?: string;
  numeroIdentificacion?: string;
  fotoUrl?: string;
  categorias?: CategoriaServicio[];
  categoriasServicio?: CategoriaServicio[];
  estadoOperativo?: EstadoOperativo;
  estadoValidacion?: EstadoValidacion;
  motivoRechazoValidacion?: string;
  certificaciones?: Certificacion[];
  documentos?: DocumentoTecnico[];
  activo?: boolean;
  reputacion?: number; // 1 a 5
  totalServicios?: number;
  serviciosCompletados?: number;
  deudaLiquidacion?: number; // en COP
  deudaComisionCop?: number;
  ubicacionActual?: Point;
}

/** Técnico disponible dentro de un radio (radar del cliente). */
export interface TecnicoCercano {
  id: string;
  nombre: string;
  especialidad: string;
  distanciaKm: number;
  lat: number;
  lng: number;
  disponible: boolean;
  telefono?: string;
  fotoUrl?: string;
}

export interface DiagnosticoRequest {
  fallaDetectada?: string;
  diagnostico?: string;
  observaciones?: string;
  costoManoObra?: number;
  manoDeObra?: number;
  costoRepuestos?: number;
  repuestos?: number;
  repuestosSugeridos?: string[];
  tiempoEstimadoMinutos?: number;
  tiempoEstimadoHoras?: number;
}

export interface HistorialOtItem {
  estado: EstadoOt;
  actor?: ActorOt;
  fecha: string;
  motivo?: string;
  comentario?: string;
}

export interface OtRequest {
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  evidenciaUrls?: string[];
  direccion: string;
  barrio?: string;
  latitud: number;
  longitud: number;
  equipoMarca?: string;
  equipoModelo?: string;
}

export interface OtResponse {
  id: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  tecnicoId?: string | null;
  tecnicoNombre?: string;
  tecnicoTelefono?: string;
  tecnicoFoto?: string;
  tecnicoReputacion?: number;
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  evidenciaUrls?: string[];
  direccion?: string;
  barrio?: string;
  punto?: Point;
  estado: EstadoOt;
  diagnostico?: DiagnosticoRequest;
  presupuesto?: {
    aprobado: boolean;
    total: number;
    manoObra: number;
    manoDeObra?: number;
    repuestos: number;
    tiempoEstimadoHoras?: number;
    /** Cargo fijo de diagnóstico (visita) notificado al aceptar el técnico. */
    cargoDiagnostico?: number;
    /** Cargo fijo de transporte/desplazamiento. */
    cargoTransporte?: number;
  };
  historial?: HistorialOtItem[];
  fechaCreacion?: string;
  fechaActualizacion?: string;
  radioBusquedaKm?: number;
  tiempoRestanteBroadcastSec?: number;
  /**
   * Auxiliar count declared when the offer was accepted (Ot.auxiliaresRequeridos).
   * Always present: the backend exposes it on every OT response, 0 by default,
   * and the mock DB literals carry it explicitly.
   */
  auxiliaresRequeridos: number;
  // Acta de Garantía y firma
  firmaClienteUrl?: string;
  actaGarantiaGenerada?: boolean;
  garantiaDias?: number;
  // Calificación
  calificacion?: {
    estrellas: number;
    comentario?: string;
    fecha?: string;
  };
}

export interface OfertaTecnicoResponse {
  id: string;
  otId: string;
  ot: OtResponse;
  tecnicoId: string;
  distanciaKm: number;
  radioVigenteKm: number;
  segundosRestantes: number;
  estado: OfertaEstado;
  fechaCreacion: string;
}

export interface RegistrarPagoRequest {
  monto: number;
  medioPago: MedioPago;
}

export interface LiquidacionResponse {
  id: string;
  otId: string;
  tecnicoId: string;
  tecnicoNombre?: string;
  montoServicio: number;
  comision: number; // comisión de la plataforma (environment.commissionRate)
  estado: EstadoLiquidacion;
  medioPago: MedioPago;
  comprobanteUrl?: string;
  motivoRechazo?: string;
  fechaRegistro?: string;
  fechaVerificacion?: string;
  referenciaBancaria?: string;
  referenciaPago?: string;
  fechaCreacion?: string;
}

export interface DisputaResponse {
  id: string;
  otId: string;
  clienteNombre?: string;
  tecnicoNombre?: string;
  motivo: string;
  estado: EstadoDisputa;
  resolucion?: string;
  fechaApertura?: string;
  fechaResolucion?: string;
  resueltoPor?: string;
  adminResponsable?: string;
}

export interface LeadCotizacion {
  id: string;
  empresa: string;
  contacto: string;
  correo: string;
  telefono: string;
  categoriaServicio: CategoriaServicio;
  cantidadEquipos: number;
  descripcion: string;
  fecha: string;
  atendido: boolean;
}

export interface MetricasAdminResponse {
  serviciosEnEjecucion: number;
  tecnicosVerificados: number;
  tecnicosDisponibles: number;
  tiempoPromedioRespuestaMin: number;
  incidenciasActivas: number;
  totalRecaudoMesCop: number;
  comisionesMesCop: number;
  distribucionCategorias: { categoria: CategoriaServicio; cantidad: number; porcentaje: number }[];
  historicoSemanal: { dia: string; completadas: number; canceladas: number }[];
}
