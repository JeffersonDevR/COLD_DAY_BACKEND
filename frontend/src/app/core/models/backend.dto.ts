/**
 * Contratos EXACTOS del backend Spring Boot (ColdDayApplication).
 *
 * Estos tipos reflejan los DTOs reales devueltos/aceptados por los controllers.
 * NO deben usarse directamente en las páginas: la traducción hacia los modelos de
 * vista del front vive en `backend.mappers.ts`.
 *
 * Fuente: backend/src/main/java/com/sena/cold_day/core/modules/**\/infrastructure/api.
 */
import {
  ActorOt,
  CategoriaServicio,
  EstadoDisputa,
  EstadoLiquidacion,
  EstadoOperativo,
  EstadoOt,
  EstadoRequerimiento,
  EstadoValidacion,
  EstadoValidacionProveedor,
  MedioPago,
  OfertaEstado,
  OfertaInsumoEstado,
  Point,
  Rol,
  TarifaFuente,
  TipoCliente,
} from './common.models';

/* ------------------------------------------------------------------ */
/* usuarios                                                            */
/* ------------------------------------------------------------------ */

export interface UsuarioApiResponse {
  id: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  fotoUrl: string | null;
  rol: Rol;
  fechaRegistro: string; // LocalDateTime (sin zona)
  habeasDataAceptado: boolean;
  activo: boolean;
}

export interface TokenApiResponse {
  token: string;
  expiracion: string;
  rol: Rol;
}

export interface UsuarioApiRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  fotoUrl?: string;
  rol: Rol;
  aceptaHabeasData: boolean;
}

export interface CredencialesApiRequest {
  correo: string;
  password: string;
}

export interface RecuperarContrasenaApiRequest {
  correo: string;
}

export interface RestablecerContrasenaApiRequest {
  token: string;
  nuevaPassword: string;
}

/* ------------------------------------------------------------------ */
/* clientes                                                            */
/* ------------------------------------------------------------------ */

export interface DireccionPrincipalApi {
  calle: string;
  ciudad: string;
  barrio: string | null;
  ubicacion: Point | null;
}

export interface ClienteApiResponse {
  id: string;
  usuarioId: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  fotoUrl: string | null;
  tipoCliente: TipoCliente;
  direccion: DireccionPrincipalApi;
  activo: boolean;
}

export interface ClienteApiRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  fotoUrl?: string;
  tipoCliente: TipoCliente;
  calle: string;
  ciudad: string;
  barrio?: string;
  ubicacion?: Point;
  aceptaHabeasData: boolean;
}

export interface UbicacionApiRequest {
  latitud: number;
  longitud: number;
}

/* ------------------------------------------------------------------ */
/* tecnicos                                                            */
/* ------------------------------------------------------------------ */

export interface CertificacionApi {
  nombre: string;
  institucion: string | null;
  fechaObtencion: string | null;
  fechaVencimiento: string | null;
}

export interface TecnicoApiResponse {
  id: string;
  usuarioId: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  numeroIdentificacion: string;
  fotoUrl: string | null;
  categoriasServicio: CategoriaServicio[];
  estadoOperativo: EstadoOperativo;
  estadoValidacion: EstadoValidacion;
  motivoRechazoValidacion: string | null;
  certificaciones: CertificacionApi[];
  activo: boolean;
  /**
   * Última posición guardada por el técnico (PUT /api/tecnicos/me/ubicacion).
   * `null` mientras nunca haya reportado una.
   */
  ubicacion: Point | null;
  /** Instante ISO-8601 de `ubicacion`; `null` si nunca reportó. */
  ubicacionActualizadaEn: string | null;
}

export interface TecnicoCercanoApiResponse {
  id: string;
  nombre: string;
  telefono: string | null;
  fotoUrl: string | null;
  categoriasServicio: CategoriaServicio[];
  distanciaKm: number;
  latitud: number;
  longitud: number;
  disponible: boolean;
}

export interface TecnicoApiRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  numeroIdentificacion: string;
  fotoUrl?: string;
  categoriasServicio: CategoriaServicio[];
  certificaciones?: CertificacionApi[];
  aceptaHabeasData: boolean;
}

export interface ValidacionTecnicoApiRequest {
  /** El backend aprueba SOLO con "APROBAR"; cualquier otro valor rechaza. */
  accion: 'APROBAR' | 'RECHAZAR';
  motivo?: string;
}

export interface EstadoOperativoApiRequest {
  estadoOperativo: EstadoOperativo;
}

export interface DocumentoTecnicoApiRequest {
  tipo: string;
  fechaVencimiento?: string;
}

export interface DocumentoTecnicoApiResponse {
  id: number;
  /** El backend serializa TecnicoId como {"valor": "<uuid>"}. */
  tecnicoId: { valor: string } | string;
  tipo: string;
  fechaVencimiento: string | null;
  vigente: boolean;
}

/* ------------------------------------------------------------------ */
/* proveedores                                                         */
/* ------------------------------------------------------------------ */

export interface ProveedorApiRequest {
  nombre: string;
  correo: string;
  password: string;
  telefono?: string;
  razonSocial: string;
  nit: string;
  aceptaHabeasData: boolean;
}

/** ProveedorApiResponse.java: expone la identidad comercial y su usuarioId, sin credenciales. */
export interface ProveedorApiResponse {
  id: string;
  usuarioId: number;
  razonSocial: string;
  nit: string;
  telefono: string | null;
  activo: boolean;
  creadoEn: string | null;
  /**
   * EstadoValidacionProveedor.java. El backend siempre lo emite, tambien en el
   * alta: un proveedor recien registrado nace `PENDIENTE` porque V8 dejo la
   * columna sin DEFAULT y `Proveedor.crear` la declara de forma explicita.
   */
  estadoValidacion: EstadoValidacionProveedor;
}

/** DocumentoProveedorApiRequest.java: solo metadata, sin archivo ni upload. */
export interface DocumentoProveedorApiRequest {
  tipo: string;
  fechaVencimiento?: string | null;
}

/** DocumentoProveedorApiResponse.java: el expediente es metadata-only. */
export interface DocumentoProveedorApiResponse {
  id: number;
  tipo: string;
  fechaVencimiento: string | null;
}

/** ValidacionProveedorApiRequest.java: espeja ValidacionTecnicoApiRequest. */
export interface ValidacionProveedorApiRequest {
  /** El backend aprueba SOLO con "APROBAR"; cualquier otro valor rechaza. */
  accion: 'APROBAR' | 'RECHAZAR';
  motivo?: string;
}

/* ------------------------------------------------------------------ */
/* ot                                                                  */
/* ------------------------------------------------------------------ */

export interface DiagnosticoApi {
  fallaDetectada: string;
  observaciones: string | null;
  registradoEn: string;
}

export interface PresupuestoApi {
  costoManoObra: number;
  costoRepuestos: number;
  emitidoEn: string;
}

export interface OtApiResponse {
  id: string;
  clienteId: string;
  tecnicoId: string | null;
  estado: EstadoOt;
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  direccion: string;
  radioKm: number;
  creadaEn: string;
  canceladaPor: ActorOt | null;
  motivoCancelacion: string | null;
  tarifaVisita: number | null;
  diagnostico: DiagnosticoApi | null;
  presupuesto: PresupuestoApi | null;
  latitud: number | null;
  longitud: number | null;
  clienteNombre: string | null;
  tecnicoNombre: string | null;
  /** OT column `auxiliares_requeridos`: always present, 0 for legacy rows. */
  auxiliaresRequeridos: number;
  /**
   * Acta de garantía firmada (V11). La FIRMA no viaja aquí: puede llegar a
   * ~1 MB y cada lectura de la OT arrastraría la tinta. El backend persiste
   * código e instante juntos, así que `true` sin código no puede ocurrir.
   *
   * Opcionales a propósito: el mapper trata la ausencia igual que `false`, y
   * así un fixture de test o una fila de una versión anterior del backend no
   * obliga a mentir para compilar.
   */
  actaFirmada?: boolean;
  actaCodigoVerificacion?: string | null;
  actaFirmadaEn?: string | null;
}

/**
 * Respuesta real de POST /api/ot/{otId}/acta (ActaGuarantiaApiResponse.java).
 * Es lo único que autoriza a la UI a afirmar que el acta existe.
 */
export interface ActaGarantiaApiResponse {
  otId: string;
  codigoVerificacion: string;
  firmadaEn: string;
}

export interface OtApiRequest {
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  evidenciaUrls?: string[];
  direccion: string;
  latitud: number;
  longitud: number;
}

/** Una línea de insumo libre declarada por el técnico (spec disp.R1, AD5). */
export interface InsumoLineaApi {
  descripcion: string;
  cantidad: number;
}

/**
 * Requerimiento de insumos (SolicitudInsumoApiResponse.java): estado raíz del
 * despacho + las líneas declaradas. `estado` ∈ {SOLICITADO, ASIGNADO,
 * ENTREGADO, SIN_PROVEEDOR}.
 */
export interface SolicitudInsumoApiResponse {
  id: string;
  otId: string;
  tecnicoId: string;
  estado: EstadoRequerimiento;
  observaciones: string | null;
  items: InsumoLineaApi[];
  creadaEn: string | null;
  expiraEn: string | null;
  resueltaEn: string | null;
}

/**
 * Oferta de insumos (OfertaInsumoApiResponse.java): estado por proveedor
 * (PENDIENTE, ACEPTADA, RECHAZADO, EXPIRADA, CANCELADA) con el requerimiento
 * embebido cuando el caller lo posee.
 */
export interface OfertaInsumoApiResponse {
  id: string;
  requerimientoId: string;
  proveedorId: string;
  estado: OfertaInsumoEstado;
  creadaEn: string | null;
  expiraEn: string | null;
  resueltaEn: string | null;
  requerimiento: SolicitudInsumoApiResponse | null;
}

export interface DiagnosticoApiRequest {
  fallaDetectada: string;
  observaciones?: string;
  costoManoObra: number;
  costoRepuestos: number;
  /**
   * Opcional: cero insumos no crean requerimiento y dejan el diagnóstico
   * intacto. Las líneas viven en las tablas de despacho, nunca en el JSON
   * `diagnostico` (AD5).
   */
  insumos?: InsumoLineaApi[];
}

export interface CancelarOtApiRequest {
  motivo: string;
}

export interface RechazoPresupuestoApiRequest {
  motivo?: string;
}

export interface HistorialEstadoApiResponse {
  estadoOrigen: EstadoOt | null;
  estadoDestino: EstadoOt;
  actor: ActorOt;
  ocurridoEn: string;
  motivo: string | null;
}

export interface OfertaOtApiResponse {
  id: string;
  otId: string;
  tecnicoId: string;
  radioKm: number;
  estado: OfertaEstado;
  creadaEn: string;
  expiraEn: string;
}

export interface TarifaEstimarApiRequest {
  latitud: number;
  longitud: number;
}

/**
 * Respuesta real de POST /api/ot/tarifa/estimar (TarifaEstimadaResponse.java).
 * `banda` y `tarifa` son `null` explicito cuando `fueraDeRango` es true.
 */
export interface TarifaEstimadaApiResponse {
  distanciaKm: number;
  tarifaFuente: TarifaFuente;
  banda: number | null;
  tarifa: number | null;
  fueraDeRango: boolean;
}

/* ------------------------------------------------------------------ */
/* administracion / liquidaciones / disputas                           */
/* ------------------------------------------------------------------ */

export interface LiquidacionApiResponse {
  id: string;
  otId: string;
  tecnicoId: string;
  montoCobrado: number;
  medioPago: MedioPago;
  porcentajeComision: number;
  valorComision: number;
  estado: EstadoLiquidacion;
  comprobanteUrl: string | null;
  motivoRechazo: string | null;
  creadaEn: string;
  verificadaEn: string | null;
  tecnicoNombre: string | null;
}

export interface RegistrarPagoApiRequest {
  montoCobrado: number;
  medioPago: MedioPago;
}

export interface ComprobanteApiRequest {
  comprobanteUrl: string;
}

export interface RechazoLiquidacionApiRequest {
  motivo: string;
}

export interface DisputaApiResponse {
  id: string;
  otId: string;
  motivo: string;
  estado: EstadoDisputa;
  resolucion: string | null;
  creadaEn: string;
  resueltaEn: string | null;
  clienteNombre: string | null;
  tecnicoNombre: string | null;
}

export interface AbrirDisputaApiRequest {
  motivo: string;
}

export interface ResolverDisputaApiRequest {
  conAcuerdo: boolean;
  resolucion: string;
}

export interface MetricasAdminApiResponse {
  otsEnEjecucion: number;
  otsPorEstado: Partial<Record<EstadoOt, number>>;
  tecnicosVerificados: number;
  tecnicosTotales: number;
  tecnicosBloqueadosPorLiquidacion: number;
  tecnicosDisponibles: number;
  tiempoPromedioAsignacionSegundos: number | null;
  disputasAbiertas: number;
  liquidacionesPendientesVerificacion: number;
  totalRecaudoMesCop: number;
  comisionesMesCop: number;
  distribucionCategorias: { categoria: CategoriaServicio; cantidad: number; porcentaje: number }[];
  historicoSemanal: { dia: string; completadas: number; canceladas: number }[];
}

/* ------------------------------------------------------------------ */
/* maps                                                               */
/* ------------------------------------------------------------------ */

export interface EstadoMapsApiResponse {
  enabled: boolean;
  configured: boolean;
  language: string;
  region: string;
}

export interface DireccionApiResponse {
  direccionFormateada: string;
  latitud: number;
  longitud: number;
  placeId: string;
}

export interface SugerenciaApiResponse {
  descripcion: string;
  placeId: string;
}

export interface DistanciaApiResponse {
  distanciaKm: number;
  duracionMin: number;
  distanciaTexto: string;
  duracionTexto: string;
}
