import {
  aDiagnosticoApiRequest,
  aDisputaResponse,
  aDocumentoTecnico,
  aHistorialOtItem,
  aLiquidacionResponse,
  aMetricasAdmin,
  aOfertaInsumoResponse,
  aOfertaTecnico,
  aOtApiRequest,
  aOtResponse,
  aProveedorResponse,
  aSolicitudInsumoResponse,
  aTarifaEstimadaResponse,
  aTecnicoCercano,
  aTecnicoResponse,
  aUsuarioResponse,
} from './backend.mappers';
import {
  DisputaApiResponse,
  DocumentoTecnicoApiResponse,
  LiquidacionApiResponse,
  MetricasAdminApiResponse,
  OfertaInsumoApiResponse,
  OfertaOtApiResponse,
  OtApiResponse,
  ProveedorApiResponse,
  SolicitudInsumoApiResponse,
  TarifaEstimadaApiResponse,
  TecnicoApiResponse,
  TecnicoCercanoApiResponse,
  UsuarioApiResponse,
} from './backend.dto';

const otDto = (overrides: Partial<OtApiResponse> = {}): OtApiResponse => ({
  id: 'ot1',
  clienteId: 'c1',
  tecnicoId: null,
  estado: 'SOLICITADA',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  direccion: 'calle 1',
  radioKm: 10,
  creadaEn: '2026-01-01T00:00:00',
  canceladaPor: null,
  motivoCancelacion: null,
  tarifaVisita: null,
  diagnostico: null,
  presupuesto: null,
  latitud: null,
  longitud: null,
  clienteNombre: null,
  tecnicoNombre: null,
  auxiliaresRequeridos: 0,
  ...overrides,
});

describe('backend.mappers — despacho de insumos', () => {
  it('mapea un requerimiento con sus líneas y normaliza los null a undefined', () => {
    const dto: SolicitudInsumoApiResponse = {
      id: 'REQ-1',
      otId: 'OT-1',
      tecnicoId: 'TEC-1',
      estado: 'ASIGNADO',
      observaciones: null,
      items: [{ descripcion: 'Capacitor 45uF', cantidad: 2 }],
      creadaEn: '2026-09-15T09:00:00Z',
      expiraEn: null,
      resueltaEn: null,
    };

    const vm = aSolicitudInsumoResponse(dto);

    expect(vm.estado).toBe('ASIGNADO');
    expect(vm.observaciones).toBeUndefined();
    expect(vm.expiraEn).toBeUndefined();
    expect(vm.items).toEqual([{ descripcion: 'Capacitor 45uF', cantidad: 2 }]);
  });

  it('tolera una oferta sin requerimiento embebido (respuesta de rechazo)', () => {
    const dto: OfertaInsumoApiResponse = {
      id: 'OF-1',
      requerimientoId: 'REQ-1',
      proveedorId: 'PROV-1',
      estado: 'RECHAZADO',
      creadaEn: null,
      expiraEn: null,
      resueltaEn: '2026-09-15T09:05:00Z',
      requerimiento: null,
    };

    const vm = aOfertaInsumoResponse(dto);

    expect(vm.estado).toBe('RECHAZADO');
    expect(vm.requerimiento).toBeNull();
    expect(vm.resueltaEn).toBe('2026-09-15T09:05:00Z');
  });

  it('mapea la oferta con su requerimiento embebido', () => {
    const dto: OfertaInsumoApiResponse = {
      id: 'OF-2',
      requerimientoId: 'REQ-2',
      proveedorId: 'PROV-1',
      estado: 'PENDIENTE',
      creadaEn: '2026-09-15T09:00:00Z',
      expiraEn: '2026-09-15T09:15:00Z',
      resueltaEn: null,
      requerimiento: {
        id: 'REQ-2',
        otId: 'OT-2',
        tecnicoId: 'TEC-2',
        estado: 'SOLICITADO',
        observaciones: 'Entrega en sitio',
        items: [{ descripcion: 'Breaker 2x40A', cantidad: 1 }],
        creadaEn: '2026-09-15T09:00:00Z',
        expiraEn: '2026-09-15T09:15:00Z',
        resueltaEn: null,
      },
    };

    const vm = aOfertaInsumoResponse(dto);

    expect(vm.requerimiento?.id).toBe('REQ-2');
    expect(vm.requerimiento?.items[0].descripcion).toBe('Breaker 2x40A');
  });
});

describe('backend.mappers — contratos existentes', () => {
  it('mapea usuario y normaliza los campos opcionales', () => {
    const dto: UsuarioApiResponse = {
      id: 1,
      nombre: 'Ana',
      correo: 'a@x.co',
      telefono: null,
      fotoUrl: null,
      rol: 'CLIENTE',
      fechaRegistro: '2026-01-01T00:00:00',
      habeasDataAceptado: true,
      activo: true,
    };
    expect(aUsuarioResponse(dto)).toMatchObject({ id: 1, nombre: 'Ana', telefono: undefined, fotoUrl: undefined });
  });

  it('mapea el perfil y certificaciones del técnico', () => {
    const dto: TecnicoApiResponse = {
      id: 't1', usuarioId: 10, nombre: 'Juan', correo: 'j@x.co', telefono: '3001234567',
      numeroIdentificacion: '123456', fotoUrl: null, categoriasServicio: ['REFRIGERACION'],
      estadoOperativo: 'DISPONIBLE', estadoValidacion: 'APROBADO', motivoRechazoValidacion: null,
      certificaciones: [{ nombre: 'SENA', institucion: 'SENA', fechaObtencion: null, fechaVencimiento: null }],
      activo: true,
    };
    expect(aTecnicoResponse(dto)).toMatchObject({
      id: 't1', cedula: '123456', categorias: ['REFRIGERACION'], deudaLiquidacion: 0,
      certificaciones: [{ nombre: 'SENA' }], documentos: [],
    });
  });

  it('mapea ubicación y especialidad del técnico cercano', () => {
    const dto: TecnicoCercanoApiResponse = {
      id: 't1', nombre: 'Juan', telefono: null, fotoUrl: null,
      categoriasServicio: ['AIRE_ACONDICIONADO', 'ELECTRICIDAD'],
      distanciaKm: 3.2, latitud: 4.6, longitud: -74.1, disponible: true,
    };
    expect(aTecnicoCercano(dto)).toMatchObject({
      especialidad: 'AIRE ACONDICIONADO · ELECTRICIDAD', lat: 4.6, lng: -74.1, telefono: undefined,
    });
  });

  it('traduce vigencia de documento a estado y semáforo', () => {
    const dto: DocumentoTecnicoApiResponse = {
      id: 1, tecnicoId: { valor: 't1' }, tipo: 'CEDULA', fechaVencimiento: null, vigente: true,
    };
    expect(aDocumentoTecnico(dto)).toMatchObject({ id: '1', estadoValidacion: 'APROBADO', semaforo: 'VERDE' });
    expect(aDocumentoTecnico({ ...dto, vigente: false })).toMatchObject({ estadoValidacion: 'RECHAZADO', semaforo: 'ROJO' });
  });

  it('mapea OT, presupuesto, coordenadas y conteo de auxiliares', () => {
    const dto = otDto({
      estado: 'ASIGNADA', latitud: 4.6, longitud: -74.1, clienteNombre: 'Ana', auxiliaresRequeridos: 2,
      diagnostico: { fallaDetectada: 'compresor', observaciones: null, registradoEn: '2026-01-01T01:00:00' },
      presupuesto: { costoManoObra: 50000, costoRepuestos: 30000, emitidoEn: '2026-01-01T02:00:00' },
    });
    expect(aOtResponse(dto)).toMatchObject({
      punto: { latitud: 4.6, longitud: -74.1 }, presupuesto: { total: 80000, manoDeObra: 50000 },
      diagnostico: { fallaDetectada: 'compresor' }, clienteNombre: 'Ana', auxiliaresRequeridos: 2,
    });
    expect(aOtResponse(otDto()).punto).toBeUndefined();
  });

  it('normaliza los formularios de creación de OT y diagnóstico', () => {
    expect(aOtApiRequest({
      categoriaServicio: 'ELECTRICIDAD', descripcionFalla: 'corto', direccion: 'calle 9', latitud: 1, longitud: 2,
    })).toMatchObject({ categoriaServicio: 'ELECTRICIDAD', direccion: 'calle 9', latitud: 1, longitud: 2 });
    expect(aDiagnosticoApiRequest({ diagnostico: 'falla', manoDeObra: 1000, repuestos: 500 })).toEqual({
      fallaDetectada: 'falla', observaciones: undefined, costoManoObra: 1000, costoRepuestos: 500, insumos: [],
    });
    expect(aDiagnosticoApiRequest({
      fallaDetectada: 'x', costoManoObra: 10, costoRepuestos: 20,
      insumos: [{ descripcion: 'Capacitor', cantidad: 2 }],
    }).insumos).toEqual([{ descripcion: 'Capacitor', cantidad: 2 }]);
  });

  it('mapea historial y tiempo de expiración de una oferta técnica', () => {
    expect(aHistorialOtItem({
      estadoOrigen: 'SOLICITADA', estadoDestino: 'ASIGNADA', actor: 'SISTEMA',
      ocurridoEn: '2026-01-01T00:00:00', motivo: 'asignada',
    })).toMatchObject({ estado: 'ASIGNADA', actor: 'SISTEMA', comentario: 'asignada' });
    const oferta: OfertaOtApiResponse = {
      id: 'of1', otId: 'ot1', tecnicoId: 't1', radioKm: 10, estado: 'PENDIENTE',
      creadaEn: '2026-01-01T00:00:00', expiraEn: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(aOfertaTecnico(oferta, aOtResponse(otDto())).segundosRestantes).toBeGreaterThan(0);
    expect(aOfertaTecnico({ ...oferta, expiraEn: 'invalid' }, aOtResponse(otDto())).segundosRestantes).toBe(0);
  });

  it('mapea liquidación, disputa y métricas administrativas', () => {
    const liquidacion: LiquidacionApiResponse = {
      id: 'l1', otId: 'ot1', tecnicoId: 't1', montoCobrado: 100000, medioPago: 'EFECTIVO',
      porcentajeComision: 0.15, valorComision: 15000, estado: 'PENDIENTE_CONSIGNACION',
      comprobanteUrl: null, motivoRechazo: null, creadaEn: '2026-01-01T00:00:00',
      verificadaEn: null, tecnicoNombre: null,
    };
    expect(aLiquidacionResponse(liquidacion)).toMatchObject({ montoServicio: 100000, comision: 15000, fechaVerificacion: undefined });
    const disputa: DisputaApiResponse = {
      id: 'd1', otId: 'ot1', motivo: 'no llegó', estado: 'ABIERTA', resolucion: null,
      creadaEn: '2026-01-01T00:00:00', resueltaEn: null, clienteNombre: null, tecnicoNombre: null,
    };
    expect(aDisputaResponse(disputa)).toMatchObject({ estado: 'ABIERTA', resolucion: undefined });
    const metricas: MetricasAdminApiResponse = {
      otsEnEjecucion: 4, otsPorEstado: {}, tecnicosVerificados: 2, tecnicosTotales: 5,
      tecnicosBloqueadosPorLiquidacion: 0, tecnicosDisponibles: 3, tiempoPromedioAsignacionSegundos: 90,
      disputasAbiertas: 1, liquidacionesPendientesVerificacion: 0, totalRecaudoMesCop: 1000,
      comisionesMesCop: 150, distribucionCategorias: [], historicoSemanal: [],
    };
    expect(aMetricasAdmin(metricas)).toMatchObject({ tiempoPromedioRespuestaMin: 1.5, serviciosEnEjecucion: 4 });
    expect(aMetricasAdmin({ ...metricas, tiempoPromedioAsignacionSegundos: null }).tiempoPromedioRespuestaMin).toBe(0);
  });

  it('mapea proveedor y tarifa estimada', () => {
    const proveedor: ProveedorApiResponse = {
      id: 'p1', usuarioId: 10, razonSocial: 'Suministros Norte', nit: '900123456',
      telefono: null, activo: true, creadoEn: null,
    };
    expect(aProveedorResponse(proveedor)).toMatchObject({ id: 'p1', razonSocial: 'Suministros Norte', telefono: undefined });
    const tarifa: TarifaEstimadaApiResponse = {
      distanciaKm: 35, tarifaFuente: 'LINEAL', banda: null, tarifa: null, fueraDeRango: true,
    };
    expect(aTarifaEstimadaResponse(tarifa)).toEqual(tarifa);
  });
});
