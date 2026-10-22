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
  OfertaOtConResumen,
  OtApiResponse,
  ProveedorApiResponse,
  SolicitudInsumoApiResponse,
  TarifaEstimadaApiResponse,
  TecnicoApiResponse,
  TecnicoCercanoApiResponse,
  UsuarioApiResponse,
} from '../models/backend.dto';

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
  visitaPagada: false,
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
      ubicacion: { latitud: 7.8939, longitud: -72.5078 },
      ubicacionActualizadaEn: '2026-09-15T09:00:00Z',
    };
    expect(aTecnicoResponse(dto)).toMatchObject({
      id: 't1', cedula: '123456', categorias: ['REFRIGERACION'], deudaLiquidacion: 0,
      certificaciones: [{ nombre: 'SENA' }], documentos: [],
      ubicacionActual: { latitud: 7.8939, longitud: -72.5078 },
      ubicacionActualizadaEn: '2026-09-15T09:00:00Z',
    });
    // Sin posición reportada el backend manda `null` y el modelo debe quedar vacío.
    expect(aTecnicoResponse({ ...dto, ubicacion: null, ubicacionActualizadaEn: null })).toMatchObject({
      ubicacionActual: undefined,
      ubicacionActualizadaEn: undefined,
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
      id: 1, tecnicoId: { valor: 't1' }, tipo: 'CEDULA', fechaExpedicion: '2024-01-01', fechaVencimiento: null, vigente: true,
    };
    expect(aDocumentoTecnico(dto)).toMatchObject({
      id: '1', fechaExpedicion: '2024-01-01', estadoValidacion: 'APROBADO', semaforo: 'VERDE',
    });
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

  it('expone el estado de pago de la visita de la OT (WS5)', () => {
    expect(aOtResponse(otDto({ visitaPagada: true })).visitaPagada).toBe(true);
    expect(aOtResponse(otDto({ visitaPagada: false })).visitaPagada).toBe(false);
  });

  it('expone el código legible de la OT y no lo fabrica cuando falta', () => {
    expect(aOtResponse(otDto({ codigo: 'OT-2026-0007' })).codigo).toBe('OT-2026-0007');
    // Fila anterior al backfill: el mapper no inventa un código ni cae al UUID.
    expect(aOtResponse(otDto({ codigo: null })).codigo).toBeUndefined();
    expect(aOtResponse(otDto()).codigo).toBeUndefined();
  });

  it('expone el instante de llegada del técnico y no lo inventa cuando falta', () => {
    expect(aOtResponse(otDto({ llegadaEn: '2026-10-21T15:30:00Z' })).llegadaEn).toBe('2026-10-21T15:30:00Z');
    // Todavía nadie reportó la llegada: el mapper no fabrica un instante.
    expect(aOtResponse(otDto({ llegadaEn: null })).llegadaEn).toBeUndefined();
    expect(aOtResponse(otDto()).llegadaEn).toBeUndefined();
  });

  it('mapea el historial de estados que viaja en la respuesta de la OT', () => {
    const dto = otDto({
      historial: [
        { estadoOrigen: null, estadoDestino: 'SOLICITADA', actor: 'CLIENTE', ocurridoEn: '2026-01-01T00:00:00', motivo: null },
        { estadoOrigen: 'SOLICITADA', estadoDestino: 'BUSCANDO_TECNICO', actor: 'CLIENTE', ocurridoEn: '2026-01-01T00:05:00', motivo: 'Buscando técnico' },
      ],
    });

    const vm = aOtResponse(dto);

    // El timeline del cliente se dibuja con esto: la entrada se traduce tal
    // como la emitió el servidor, sin derivar estados ni inventar momentos.
    expect(vm.historial).toHaveLength(2);
    expect(vm.historial?.[0]).toMatchObject({
      estado: 'SOLICITADA', actor: 'CLIENTE', fecha: '2026-01-01T00:00:00',
    });
    expect(vm.historial?.[1]).toMatchObject({
      estado: 'BUSCANDO_TECNICO', actor: 'CLIENTE', motivo: 'Buscando técnico', comentario: 'Buscando técnico',
    });
    // Una respuesta sin historial (un listado, una mutación) no se completa con
    // entradas inventadas.
    expect(aOtResponse(otDto()).historial).toBeUndefined();
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
    const oferta: OfertaOtConResumen = {
      id: 'of1', otId: 'ot1', tecnicoId: 't1', radioKm: 10, estado: 'PENDIENTE',
      creadaEn: '2026-01-01T00:00:00', expiraEn: new Date(Date.now() + 60_000).toISOString(),
      ot: {
        id: 'ot1', codigo: 'OT-2026-0011', estado: 'BUSCANDO_TECNICO', categoriaServicio: 'REFRIGERACION',
        descripcionFalla: 'no enfría', direccion: 'calle 1', clienteNombre: 'Ana',
        latitud: 4.6, longitud: -74.1,
      },
    };
    const vm = aOfertaTecnico(oferta);
    expect(vm.segundosRestantes).toBeGreaterThan(0);
    // La OT embebida se puebla desde el resumen de la oferta, sin un
    // GET /api/ot/{id} aparte.
    expect(vm.ot).toMatchObject({
      id: 'ot1', codigo: 'OT-2026-0011', categoriaServicio: 'REFRIGERACION', descripcionFalla: 'no enfría',
      direccion: 'calle 1', clienteNombre: 'Ana', estado: 'BUSCANDO_TECNICO',
      punto: { latitud: 4.6, longitud: -74.1 }, auxiliaresRequeridos: 0,
    });
    expect(vm.ot.barrio).toBeUndefined();
    expect(aOfertaTecnico({ ...oferta, expiraEn: 'invalid' }).segundosRestantes).toBe(0);
  });

  it('mapea liquidación, disputa y métricas administrativas', () => {
    const liquidacion: LiquidacionApiResponse = {
      id: 'l1', otId: 'ot1', otCodigo: 'OT-2026-0004', tecnicoId: 't1', montoCobrado: 100000, medioPago: 'EFECTIVO',
      porcentajeComision: 0.15, valorComision: 15000, estado: 'PENDIENTE_CONSIGNACION',
      comprobanteUrl: null, motivoRechazo: null, creadaEn: '2026-01-01T00:00:00',
      verificadaEn: null, tecnicoNombre: null,
    };
    expect(aLiquidacionResponse(liquidacion)).toMatchObject({
      montoServicio: 100000, comision: 15000, otCodigo: 'OT-2026-0004', fechaVerificacion: undefined,
    });
    // Respuesta sin código (fila anterior al backfill): la UI recibe undefined.
    expect(aLiquidacionResponse({ ...liquidacion, otCodigo: null }).otCodigo).toBeUndefined();
    const disputa: DisputaApiResponse = {
      id: 'd1', otId: 'ot1', otCodigo: 'OT-2026-0005', motivo: 'no llegó', estado: 'ABIERTA', resolucion: null,
      creadaEn: '2026-01-01T00:00:00', resueltaEn: null, clienteNombre: null, tecnicoNombre: null,
    };
    expect(aDisputaResponse(disputa)).toMatchObject({
      estado: 'ABIERTA', resolucion: undefined, otCodigo: 'OT-2026-0005',
    });
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
      telefono: null, activo: true, creadoEn: null, estadoValidacion: 'PENDIENTE',
    };
    // El estado de validación viaja: el portal lo necesita para explicar por qué
    // un proveedor recién registrado todavía no puede tomar insumos.
    expect(aProveedorResponse(proveedor)).toMatchObject({
      id: 'p1', razonSocial: 'Suministros Norte', telefono: undefined, estadoValidacion: 'PENDIENTE',
    });
    const tarifa: TarifaEstimadaApiResponse = {
      distanciaKm: 35, tarifaFuente: 'LINEAL', banda: null, tarifa: null, fueraDeRango: true,
    };
    expect(aTarifaEstimadaResponse(tarifa)).toEqual(tarifa);
  });
});
