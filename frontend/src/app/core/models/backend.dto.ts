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
  /** Conjunto de roles derivado del perfil (TokenResponse.java, slice 4). */
  roles: Rol[];
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
  /**
   * Solo viene en POST /api/clientes/perfil: el alta del segundo perfil sube
   * `tokenVersion` y entrega acá el JWT de reemplazo. En cualquier otra lectura
   * la clave está ausente (el backend omite el null).
   */
  token?: string;
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

/**
 * Body of POST /api/clientes/perfil (ClientePerfilApiRequest.java): adquisición
 * del segundo perfil CLIENTE por el usuario autenticado. NO lleva `rol`: el rol
 * sale del tipo de perfil, nunca del cuerpo (M5). `barrio` y `ubicacion` son
 * opcionales. El usuario destino es SIEMPRE el principal, no un id del cuerpo.
 */
export interface ClientePerfilApiRequest {
  tipoCliente: TipoCliente;
  calle: string;
  ciudad: string;
  barrio?: string;
  ubicacion?: Point;
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
  /**
   * Solo viene en POST /api/tecnicos/perfil: el alta del segundo perfil sube
   * `tokenVersion` y entrega acá el JWT de reemplazo. En cualquier otra lectura
   * la clave está ausente (el backend omite el null).
   */
  token?: string;
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

/**
 * Body of POST /api/tecnicos/perfil (TecnicoPerfilApiRequest.java): adquisición
 * del segundo perfil TECNICO por el usuario autenticado. NO lleva `rol`: el rol
 * sale del tipo de perfil, nunca del cuerpo (M5). El usuario destino es SIEMPRE
 * el principal, no un id del cuerpo.
 */
export interface TecnicoPerfilApiRequest {
  numeroIdentificacion: string;
  categoriasServicio: CategoriaServicio[];
  certificaciones?: CertificacionApi[];
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
  /** Fecha de expedición: obligatoria en el backend (@NotNull). */
  fechaExpedicion: string;
  fechaVencimiento?: string;
}

export interface DocumentoTecnicoApiResponse {
  id: number;
  /** El backend serializa TecnicoId como {"valor": "<uuid>"}. */
  tecnicoId: { valor: string } | string;
  tipo: string;
  fechaExpedicion: string | null;
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
  /**
   * Código legible de la OT (`OT-YYYY-####`). Opcional a propósito, como
   * `actaFirmada`: la columna es nullable y una fila anterior al backfill de
   * V14 puede no traerlo. La UI cae a su propio texto, nunca al UUID.
   */
  codigo?: string | null;
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
  /** WS5: el backend expone si la tarifa de visita ya fue cobrada. */
  visitaPagada: boolean;
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
  /**
   * Instante (ISO-8601) en que el técnico confirmó su llegada al sitio.
   *
   * Opcional a propósito: la llegada es un HECHO y no una transición, así que
   * no hay estado del que deducirla. Viene `null` mientras nadie la reporta.
   */
  llegadaEn?: string | null;
  /**
   * Historial de estados de la orden (append-only), tal como lo expone el
   * backend en la respuesta de la OT.
   *
   * Opcional a propósito: un listado o la respuesta de una mutación pueden no
   * traerlo, y el mapper no completa lo que el servidor no envió.
   */
  historial?: HistorialEstadoApiResponse[];
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

/**
 * POST /api/ot/{id}/insumos (InsumoSolicitudApiRequest.java): solicitud de
 * repuestos a posteriori del técnico asignado. A diferencia del diagnóstico,
 * las líneas son obligatorias (`@NotEmpty`: una petición vacía es 400, no un
 * no-op) y `observaciones` es opcional (max 1000, el backend la limpia).
 */
export interface InsumoSolicitudApiRequest {
  observaciones: string | null;
  insumos: InsumoLineaApi[];
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

/**
 * Resumen reducido de la OT que viaja embebido en una oferta pendiente.
 *
 * NO es un OtApiResponse completo a propósito: quien sostiene una oferta
 * PENDIENTE todavía no participa de la orden, así que los datos posteriores a
 * la asignación (diagnostico, presupuesto, actaCodigoVerificacion, clienteId,
 * tarifaVisita, calificacion*) quedan fuera y no se agregarán.
 */
export interface OfertaOtResumenApiResponse {
  id: string;
  /**
   * Código legible de la OT ofertada. Es lo que el técnico lee y cita; el `id`
   * sigue viajando porque es el que resuelve las rutas.
   */
  codigo?: string | null;
  estado: EstadoOt;
  categoriaServicio: CategoriaServicio;
  descripcionFalla: string;
  direccion: string;
  clienteNombre: string | null;
  latitud: number;
  longitud: number;
}

export interface OfertaOtApiResponse {
  id: string;
  otId: string;
  tecnicoId: string;
  radioKm: number;
  estado: OfertaEstado;
  creadaEn: string;
  expiraEn: string;
  /**
   * Resumen reducido de la OT embebido por el backend (ver OfertaOtResumenApiResponse).
   *
   * Puede llegar `null`: el backend mantiene una rama defensiva para una oferta
   * cuyo orden no se pudo resolver. El consumidor DEBE descartar esa oferta en
   * vez de leerla, o la lista entera se cae.
   */
  ot: OfertaOtResumenApiResponse | null;
}

/**
 * Oferta con su resumen de OT garantizado. Es lo que el mapper necesita: el
 * filtro de `getOfertasParaTecnico` descarta las ofertas sin orden, así que para
 * cuando el mapper las ve, el resumen ya no puede ser null.
 */
export type OfertaOtConResumen = OfertaOtApiResponse & { ot: OfertaOtResumenApiResponse };

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
  /** Código legible de la OT liquidada; el backend lo expone junto al `otId`. */
  otCodigo?: string | null;
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
  /** Código legible de la OT en disputa; el backend lo expone junto al `otId`. */
  otCodigo?: string | null;
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
