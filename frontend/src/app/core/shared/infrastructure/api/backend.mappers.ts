/**
 * Traducción entre los DTOs reales del backend y los modelos de vista del front.
 *
 * Regla: las páginas siguen consumiendo los modelos ricos de `common.models.ts`;
 * toda diferencia de forma/campos con el backend se resuelve ACÁ.
 *
 * Donde el backend no expone un dato, se deja un valor seguro y se marca con
 * TODO(backend) para no fingir información que no existe.
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
  TecnicoResponse,
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
  TecnicoApiResponse,
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
    // TODO(backend): el backend aún no expone deuda ni documentos en TecnicoApiResponse.
    deudaLiquidacion: 0,
    deudaComisionCop: 0,
    documentos: [],
  };
}

export function aDocumentoTecnico(dto: DocumentoTecnicoApiResponse): DocumentoTecnico {
  return {
    id: String(dto.id),
    tipo: dto.tipo,
    nombre: dto.tipo,
    fechaVencimiento: dto.fechaVencimiento ?? undefined,
    // TODO(backend): DocumentoTecnicoApiResponse solo expone `vigente`,
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
    // TODO(backend): OtApiResponse no expone fecha de actualización ni coordenadas.
    fechaActualizacion: dto.creadaEn,
    radioBusquedaKm: dto.radioKm,
    evidenciaUrls: [],
    // TODO(backend): clienteNombre/barrio/punto/historial requieren endpoints o
    // campos que el backend aún no expone (historial: GET /api/ot/{id}/historial).
  };
}

/**
 * Normaliza el formulario de creación de OT al contrato del backend.
 * TODO(backend): OtApiRequest no acepta `barrio`, `equipoMarca` ni `equipoModelo`;
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
    // TODO(backend): OfertaOtApiResponse no expone distancia; se usa el radio difundido.
    distanciaKm: 0,
    radioVigenteKm: dto.radioKm,
    segundosRestantes: segundosHasta(dto.expiraEn),
    estado: dto.estado,
    fechaCreacion: dto.creadaEn,
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
    // TODO(backend): LiquidacionApiResponse no expone referencias ni nombre del técnico.
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
    // TODO(backend): DisputaApiResponse no expone nombres de cliente/técnico ni responsable.
  };
}

export function aMetricasAdmin(dto: MetricasAdminApiResponse): MetricasAdminResponse {
  return {
    serviciosEnEjecucion: dto.otsEnEjecucion,
    tecnicosVerificados: dto.tecnicosVerificados,
    // TODO(backend): el backend no expone técnicos disponibles en las métricas.
    tecnicosDisponibles: 0,
    tiempoPromedioRespuestaMin:
      dto.tiempoPromedioAsignacionSegundos === null
        ? 0
        : Math.round((dto.tiempoPromedioAsignacionSegundos / 60) * 10) / 10,
    incidenciasActivas: dto.disputasAbiertas,
    // TODO(backend): el backend no expone recaudo/comisiones históricas ni distribución
    // por categoría/semanal en MetricasAdminApiResponse.
    totalRecaudoMesCop: 0,
    comisionesMesCop: 0,
    distribucionCategorias: [],
    historicoSemanal: [],
  };
}
