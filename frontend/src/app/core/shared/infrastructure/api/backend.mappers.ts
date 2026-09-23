/**
 * Traducción entre los DTOs reales del backend y los modelos de vista del front.
 *
 * Regla: las páginas siguen consumiendo los modelos ricos de `common.models.ts`;
 * toda diferencia de forma/campos con el backend se resuelve ACÁ.
 *
 * Donde el backend no expone un dato, se deja un valor seguro y se marca con
 * Pendiente(backend) para no fingir información que no existe.
 */
import {
  Certificacion,
  DiagnosticoRequest,
  DisputaResponse,
  DocumentoTecnico,
  HistorialOtItem,
  LiquidacionResponse,
  MetricasAdminResponse,
  OfertaTecnicoResponse,
  OtRequest,
  OtResponse,
  ProveedorResponse,
  TarifaEstimadaResponse,
  TecnicoCercano,
  TecnicoResponse,
  TipoDocumentoTecnico,
  UsuarioResponse,
} from '../../domain/models/common.models';
import {
  CertificacionApi,
  DiagnosticoApi,
  DiagnosticoApiRequest,
  DisputaApiResponse,
  DocumentoTecnicoApiResponse,
  HistorialEstadoApiResponse,
  LiquidacionApiResponse,
  MetricasAdminApiResponse,
  OfertaOtApiResponse,
  OtApiRequest,
  OtApiResponse,
  PresupuestoApi,
  ProveedorApiResponse,
  TarifaEstimadaApiResponse,
  TecnicoApiResponse,
  TecnicoCercanoApiResponse,
  UsuarioApiResponse,
} from './backend.dto';

/** Segundos restantes hasta una fecha ISO; 0 si ya venció o es inválida. */
function segundosHasta(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

export function aUsuarioResponse(dto: UsuarioApiResponse): UsuarioResponse {
  return {
    id: dto.id,
    nombre: dto.nombre,
    correo: dto.correo,
    telefono: dto.telefono ?? undefined,
    fotoUrl: dto.fotoUrl ?? undefined,
    rol: dto.rol,
    fechaRegistro: dto.fechaRegistro,
    habeasDataAceptado: dto.habeasDataAceptado,
    activo: dto.activo,
  };
}

export function aCertificacion(dto: CertificacionApi): Certificacion {
  return {
    nombre: dto.nombre,
    institucion: dto.institucion ?? undefined,
    fechaObtencion: dto.fechaObtencion ?? undefined,
    fechaVencimiento: dto.fechaVencimiento ?? undefined,
  };
}

export function aTecnicoResponse(dto: TecnicoApiResponse): TecnicoResponse {
  return {
    id: dto.id,
    usuarioId: dto.usuarioId,
    nombre: dto.nombre,
    nombreCompleto: dto.nombre,
    numeroIdentificacion: dto.numeroIdentificacion,
    cedula: dto.numeroIdentificacion,
    correo: dto.correo,
    telefono: dto.telefono ?? undefined,
    fotoUrl: dto.fotoUrl ?? undefined,
    categorias: dto.categoriasServicio,
    categoriasServicio: dto.categoriasServicio,
    estadoOperativo: dto.estadoOperativo,
    estadoValidacion: dto.estadoValidacion,
    motivoRechazoValidacion: dto.motivoRechazoValidacion ?? undefined,
    certificaciones: (dto.certificaciones ?? []).map(aCertificacion),
    activo: dto.activo,
    // Pendiente(backend): el backend aún no expone deuda ni documentos en TecnicoApiResponse.
    deudaLiquidacion: 0,
    deudaComisionCop: 0,
    documentos: [],
  };
}

export function aTecnicoCercano(dto: TecnicoCercanoApiResponse): TecnicoCercano {
  return {
    id: dto.id,
    nombre: dto.nombre,
    especialidad: dto.categoriasServicio.map((categoria) => categoria.replace('_', ' ')).join(' · '),
    distanciaKm: dto.distanciaKm,
    lat: dto.latitud,
    lng: dto.longitud,
    disponible: dto.disponible,
    telefono: dto.telefono ?? undefined,
    fotoUrl: dto.fotoUrl ?? undefined,
  };
}

export function aDocumentoTecnico(dto: DocumentoTecnicoApiResponse): DocumentoTecnico {
  return {
    id: String(dto.id),
    tipo: dto.tipo as TipoDocumentoTecnico,
    nombre: dto.tipo,
    fechaVencimiento: dto.fechaVencimiento ?? undefined,
    // Pendiente(backend): DocumentoTecnicoApiResponse solo expone `vigente`,
    // no una validación por documento; se aproxima con el semáforo.
    estadoValidacion: dto.vigente ? 'APROBADO' : 'RECHAZADO',
    semaforo: dto.vigente ? 'VERDE' : 'ROJO',
  };
}

function aPresupuesto(dto: PresupuestoApi): OtResponse['presupuesto'] {
  const total = (dto.costoManoObra ?? 0) + (dto.costoRepuestos ?? 0);
  return {
    aprobado: false,
    total,
    manoObra: dto.costoManoObra ?? 0,
    manoDeObra: dto.costoManoObra ?? 0,
    repuestos: dto.costoRepuestos ?? 0,
  };
}

function aDiagnostico(dto: DiagnosticoApi): DiagnosticoRequest {
  return {
    fallaDetectada: dto.fallaDetectada,
    diagnostico: dto.fallaDetectada,
    observaciones: dto.observaciones ?? undefined,
  };
}

export function aOtResponse(dto: OtApiResponse): OtResponse {
  return {
    id: dto.id,
    clienteId: dto.clienteId,
    tecnicoId: dto.tecnicoId,
    categoriaServicio: dto.categoriaServicio,
    descripcionFalla: dto.descripcionFalla,
    direccion: dto.direccion,
    estado: dto.estado,
    diagnostico: dto.diagnostico ? aDiagnostico(dto.diagnostico) : undefined,
    presupuesto: dto.presupuesto ? aPresupuesto(dto.presupuesto) : undefined,
    fechaCreacion: dto.creadaEn,
    // Pendiente(backend): OtApiResponse no expone fecha de actualización.
    fechaActualizacion: dto.creadaEn,
    radioBusquedaKm: dto.radioKm,
    punto: dto.latitud !== null && dto.longitud !== null
      ? { latitud: dto.latitud, longitud: dto.longitud }
      : undefined,
    clienteNombre: dto.clienteNombre ?? undefined,
    tecnicoNombre: dto.tecnicoNombre ?? undefined,
    auxiliaresRequeridos: dto.auxiliaresRequeridos,
    evidenciaUrls: [],
    // Pendiente(backend): barrio/historial requieren campos/endpoints que el
    // backend aún no expone (historial: GET /api/ot/{id}/historial).
  };
}

/**
 * Normaliza el formulario de creación de OT al contrato del backend.
 * Pendiente(backend): OtApiRequest no acepta `barrio`, `equipoMarca` ni `equipoModelo`;
 * esos campos del formulario no se persisten hoy.
 */
export function aOtApiRequest(req: OtRequest): OtApiRequest {
  return {
    categoriaServicio: req.categoriaServicio,
    descripcionFalla: req.descripcionFalla,
    evidenciaUrls: req.evidenciaUrls,
    direccion: req.direccion,
    latitud: req.latitud,
    longitud: req.longitud,
  };
}

/**
 * El formulario del front usa nombres mixtos (`diagnostico`, `manoDeObra`,
 * `repuestos`) y el backend exige `fallaDetectada`, `costoManoObra`,
 * `costoRepuestos`. Acá se normaliza.
 */
export function aDiagnosticoApiRequest(diag: DiagnosticoRequest): DiagnosticoApiRequest {
  return {
    fallaDetectada: diag.fallaDetectada ?? diag.diagnostico ?? '',
    observaciones: diag.observaciones,
    costoManoObra: diag.costoManoObra ?? diag.manoDeObra ?? 0,
    costoRepuestos: diag.costoRepuestos ?? diag.repuestos ?? 0,
  };
}

export function aHistorialOtItem(dto: HistorialEstadoApiResponse): HistorialOtItem {  return {
    estado: dto.estadoDestino,
    actor: dto.actor,
    fecha: dto.ocurridoEn,
    motivo: dto.motivo ?? undefined,
    comentario: dto.motivo ?? undefined,
  };
}

export function aOfertaTecnico(dto: OfertaOtApiResponse, ot: OtResponse): OfertaTecnicoResponse {
  return {
    id: dto.id,
    otId: dto.otId,
    ot,
    tecnicoId: dto.tecnicoId,
    // Pendiente(backend): OfertaOtApiResponse no expone distancia; se usa el radio difundido.
    distanciaKm: 0,
    radioVigenteKm: dto.radioKm,
    segundosRestantes: segundosHasta(dto.expiraEn),
    estado: dto.estado,
    fechaCreacion: dto.creadaEn,
  };
}

export function aTarifaEstimadaResponse(dto: TarifaEstimadaApiResponse): TarifaEstimadaResponse {
  return {
    distanciaKm: dto.distanciaKm,
    tarifaFuente: dto.tarifaFuente,
    banda: dto.banda,
    tarifa: dto.tarifa,
    fueraDeRango: dto.fueraDeRango,
  };
}

export function aProveedorResponse(dto: ProveedorApiResponse): ProveedorResponse {
  return {
    id: dto.id,
    usuarioId: dto.usuarioId,
    razonSocial: dto.razonSocial,
    nit: dto.nit,
    telefono: dto.telefono ?? undefined,
    activo: dto.activo,
    creadoEn: dto.creadoEn ?? undefined,
  };
}

export function aLiquidacionResponse(dto: LiquidacionApiResponse): LiquidacionResponse {
  return {
    id: dto.id,
    otId: dto.otId,
    tecnicoId: dto.tecnicoId,
    montoServicio: dto.montoCobrado,
    comision: dto.valorComision,
    estado: dto.estado,
    medioPago: dto.medioPago,
    comprobanteUrl: dto.comprobanteUrl ?? undefined,
    motivoRechazo: dto.motivoRechazo ?? undefined,
    fechaRegistro: dto.creadaEn,
    fechaCreacion: dto.creadaEn,
    fechaVerificacion: dto.verificadaEn ?? undefined,
    tecnicoNombre: dto.tecnicoNombre ?? undefined,
    // Pendiente(backend): LiquidacionApiResponse no expone referencias de pago.
  };
}

export function aDisputaResponse(dto: DisputaApiResponse): DisputaResponse {
  return {
    id: dto.id,
    otId: dto.otId,
    motivo: dto.motivo,
    estado: dto.estado,
    resolucion: dto.resolucion ?? undefined,
    fechaApertura: dto.creadaEn,
    fechaResolucion: dto.resueltaEn ?? undefined,
    clienteNombre: dto.clienteNombre ?? undefined,
    tecnicoNombre: dto.tecnicoNombre ?? undefined,
    // Pendiente(backend): DisputaApiResponse no expone el responsable de la resolución.
  };
}

export function aMetricasAdmin(dto: MetricasAdminApiResponse): MetricasAdminResponse {
  return {
    serviciosEnEjecucion: dto.otsEnEjecucion,
    tecnicosVerificados: dto.tecnicosVerificados,
    tecnicosDisponibles: dto.tecnicosDisponibles,
    tiempoPromedioRespuestaMin:
      dto.tiempoPromedioAsignacionSegundos === null
        ? 0
        : Math.round((dto.tiempoPromedioAsignacionSegundos / 60) * 10) / 10,
    incidenciasActivas: dto.disputasAbiertas,
    totalRecaudoMesCop: dto.totalRecaudoMesCop,
    comisionesMesCop: dto.comisionesMesCop,
    distribucionCategorias: dto.distribucionCategorias,
    historicoSemanal: dto.historicoSemanal,
  };
}
