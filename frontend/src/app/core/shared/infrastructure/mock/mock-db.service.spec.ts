import { MockDbService } from './mock-db.service';
import { ApiHttpError } from '../api/error.interceptor';

describe('MockDbService — despacho de insumos', () => {
  let db: MockDbService;

  beforeEach(() => {
    db = new MockDbService();
  });

  it('expone una oferta pendiente con su requerimiento y líneas', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE');
    expect(pendiente).toBeTruthy();
    expect(pendiente!.requerimiento?.estado).toBe('SOLICITADO');
    expect(pendiente!.requerimiento!.items.length).toBeGreaterThan(0);
  });

  it('aceptar asigna el requerimiento y deja la oferta ACEPTADA', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE')!;

    const requerimiento = db.aceptarInsumo(pendiente.id);

    expect(requerimiento.estado).toBe('ASIGNADO');
    const actualizada = db.solicitudesProveedor().find(o => o.id === pendiente.id)!;
    expect(actualizada.estado).toBe('ACEPTADA');
  });

  it('aceptar dos veces la misma oferta responde 409', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE')!;
    db.aceptarInsumo(pendiente.id);

    let capturado: unknown;
    try {
      db.aceptarInsumo(pendiente.id);
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(ApiHttpError);
    expect((capturado as ApiHttpError).status).toBe(409);
  });

  it('rechazar registra RECHAZADO sin vincular al proveedor', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE')!;

    const rechazada = db.rechazarInsumo(pendiente.id);

    expect(rechazada.estado).toBe('RECHAZADO');
    const requerimiento = db.solicitudesProveedor().find(o => o.id === pendiente.id)!.requerimiento!;
    expect(requerimiento.estado).toBe('SOLICITADO');
  });

  it('entregar marca ENTREGADO solo si la oferta está ACEPTADA', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE')!;
    const asignado = db.aceptarInsumo(pendiente.id);

    const entregado = db.entregarInsumo(asignado.id);

    expect(entregado.estado).toBe('ENTREGADO');
  });

  it('entregar una oferta no aceptada responde 404', () => {
    const pendiente = db.solicitudesProveedor().find(o => o.estado === 'PENDIENTE')!;

    let capturado: unknown;
    try {
      db.entregarInsumo(pendiente.requerimiento!.id);
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(ApiHttpError);
    expect((capturado as ApiHttpError).status).toBe(404);
  });
});

describe('MockDbService — tarifa de visita por distancia', () => {
  const db = new MockDbService();
  const centro = { latitud: 7.8939, longitud: -72.5078 };

  it('la base metropolitana es 30.000 con banda 0 y fuera de rango falso', () => {
    const estimacion = db.estimarTarifa(centro);

    expect(estimacion.fueraDeRango).toBe(false);
    expect(estimacion.banda).toBe(0);
    expect(estimacion.tarifa).toBe(30000);
    expect(estimacion.distanciaKm).toBe(0);
  });

  it('aplica el primer bracket marginal justo fuera del radio metropolitano', () => {
    // ~10 km al norte del centro: 0.09° de latitud ≈ 10 km.
    const estimacion = db.estimarTarifa({ latitud: centro.latitud + 0.09, longitud: centro.longitud });

    expect(estimacion.fueraDeRango).toBe(false);
    expect(estimacion.distanciaKm).toBeGreaterThan(8);
    expect(estimacion.distanciaKm).toBeLessThan(12);
    expect(estimacion.banda).toBe(1);
    expect(estimacion.tarifa).not.toBeNull();
    expect(estimacion.tarifa!).toBeGreaterThan(30000);
  });

  it('marca fuera de rango con banda y tarifa en null explícito', () => {
    const estimacion = db.estimarTarifa({ latitud: 0, longitud: 0 });

    expect(estimacion.fueraDeRango).toBe(true);
    expect(estimacion.banda).toBeNull();
    expect(estimacion.tarifa).toBeNull();
    expect(estimacion.distanciaKm).toBeGreaterThan(30);
  });
});

describe('MockDbService — flujos operativos existentes', () => {
  let db: MockDbService;

  beforeEach(() => {
    db = new MockDbService();
  });

  it('crearOt agrega la OT y genera ofertas para técnicos compatibles', () => {
    const ot = db.crearOt({
      clienteId: '3', clienteNombre: 'Ana', categoriaServicio: 'REFRIGERACION',
      descripcionFalla: 'no enfría', direccion: 'calle 1', latitud: 1, longitud: 2,
    });
    expect(ot.id).toBe('OT-2026-007');
    expect(ot.estado).toBe('BUSCANDO_TECNICO');
    expect(db.ordenesTrabajo()[0].id).toBe('OT-2026-007');
    expect(db.ofertas().filter((o) => o.otId === ot.id).length).toBeGreaterThan(0);
  });

  it('aceptarOferta asigna la OT y ocupa al técnico', () => {
    expect(db.aceptarOferta('OFERTA-001', 'TEC-001')).toBe(true);
    expect(db.ordenesTrabajo().find((o) => o.id === 'OT-2026-001')?.estado).toBe('ASIGNADA');
    expect(db.tecnicos().find((t) => t.id === 'TEC-001')?.estadoOperativo).toBe('OCUPADO');
    expect(db.ofertas().find((o) => o.id === 'OFERTA-001')?.estado).toBe('ACEPTADA');
  });

  it('aceptarOferta falla con oferta inexistente o técnico bloqueado', () => {
    expect(db.aceptarOferta('NO-EXISTE', 'TEC-001')).toBe(false);
    expect(db.aceptarOferta('OFERTA-001', 'TEC-002')).toBe(false);
  });

  it('avanzarEstadoOt actualiza estado e historial', () => {
    db.avanzarEstadoOt('OT-2026-001', 'EN_CAMINO', 'TECNICO', 'en ruta');
    const ot = db.ordenesTrabajo().find((o) => o.id === 'OT-2026-001');
    expect(ot?.estado).toBe('EN_CAMINO');
    expect(ot?.historial?.at(-1)?.motivo).toBe('en ruta');
  });

  it('registrarDiagnostico conserva el presupuesto con los cargos de visita', () => {
    db.registrarDiagnostico('OT-2026-001', {
      fallaDetectada: 'compresor', costoManoObra: 50000, costoRepuestos: 30000,
    });
    const ot = db.ordenesTrabajo().find((o) => o.id === 'OT-2026-001');
    expect(ot?.presupuesto?.total).toBe(80000);
    expect(ot?.presupuesto?.cargoDiagnostico).toBeGreaterThan(0);
  });

  it('aprobarPresupuesto pasa la OT a EN_REPARACION', () => {
    db.aprobarPresupuesto('OT-2026-002');
    const ot = db.ordenesTrabajo().find((o) => o.id === 'OT-2026-002');
    expect(ot?.estado).toBe('EN_REPARACION');
    expect(ot?.presupuesto?.aprobado).toBe(true);
  });

  it('rechazarPresupuesto abre una disputa', () => {
    const antes = db.disputas().length;
    db.rechazarPresupuesto('OT-2026-002', 'muy caro');
    expect(db.ordenesTrabajo().find((o) => o.id === 'OT-2026-002')?.estado).toBe('DISPUTADA');
    expect(db.disputas().length).toBe(antes + 1);
  });

  it('finalizarOtConPago genera liquidación y bloquea al técnico', () => {
    const antes = db.liquidaciones().length;
    db.finalizarOtConPago('OT-2026-002', 'EFECTIVO', 'firma-data');
    const ot = db.ordenesTrabajo().find((o) => o.id === 'OT-2026-002');
    expect(ot?.estado).toBe('FINALIZADA');
    expect(ot?.firmaClienteUrl).toBe('firma-data');
    expect(db.liquidaciones().length).toBe(antes + 1);
    expect(db.tecnicos().find((t) => t.id === 'TEC-001')?.estadoOperativo).toBe('BLOQUEADO_POR_LIQUIDACION');
  });

  it('cancelarOt libera al técnico ocupado', () => {
    db.aceptarOferta('OFERTA-001', 'TEC-001');
    db.cancelarOt('OT-2026-001', 'ya no aplica', 'CLIENTE');
    expect(db.ordenesTrabajo().find((o) => o.id === 'OT-2026-001')?.estado).toBe('CANCELADA');
    expect(db.tecnicos().find((t) => t.id === 'TEC-001')?.estadoOperativo).toBe('DISPONIBLE');
  });

  it('calificarOt guarda la calificación', () => {
    db.calificarOt('OT-2026-004', 4, 'buen servicio');
    expect(db.ordenesTrabajo().find((o) => o.id === 'OT-2026-004')?.calificacion)
      .toMatchObject({ estrellas: 4, comentario: 'buen servicio' });
  });

  it('subirComprobanteLiquidacion pasa la liquidación a verificación', () => {
    db.subirComprobanteLiquidacion('LIQ-001', 'http://img', 'ref-1');
    expect(db.liquidaciones().find((l) => l.id === 'LIQ-001'))
      .toMatchObject({ estado: 'EN_VERIFICACION', referenciaBancaria: 'ref-1' });
  });

  it('aprobarLiquidacion actualiza el estado de la liquidación', () => {
    db.aprobarLiquidacion('LIQ-001');
    expect(db.liquidaciones().find((l) => l.id === 'LIQ-001')?.estado).toBe('APROBADA');
  });

  it('rechazarLiquidacion conserva el motivo', () => {
    db.rechazarLiquidacion('LIQ-001', 'ilegible');
    expect(db.liquidaciones().find((l) => l.id === 'LIQ-001'))
      .toMatchObject({ estado: 'RECHAZADA', motivoRechazo: 'ilegible' });
  });

  it('resolverDisputa registra el acuerdo', () => {
    db.resolverDisputa('DISP-001', 'se llegó a un acuerdo', true, 'Admin');
    expect(db.disputas().find((d) => d.id === 'DISP-001')?.estado).toBe('RESUELTA_CON_ACUERDO');
  });

  it('validarTecnico aprueba el perfil', () => {
    db.validarTecnico('TEC-004', 'APROBADO');
    expect(db.tecnicos().find((t) => t.id === 'TEC-004'))
      .toMatchObject({ estadoValidacion: 'APROBADO', estadoOperativo: 'DISPONIBLE' });
  });

  it('cambiarDisponibilidadTecnico respeta la deuda pendiente', () => {
    expect(db.cambiarDisponibilidadTecnico('TEC-002', 'DISPONIBLE')).toBe(false);
    expect(db.cambiarDisponibilidadTecnico('TEC-002', 'OCUPADO')).toBe(true);
    expect(db.cambiarDisponibilidadTecnico('NO-EXISTE', 'DISPONIBLE')).toBe(false);
  });

  it('guardarLeadCotizacion agrega un lead', () => {
    const antes = db.leads().length;
    db.guardarLeadCotizacion({
      empresa: 'ACME', contacto: 'Ana', correo: 'a@acme.co', telefono: '300',
      categoriaServicio: 'ELECTRICIDAD', cantidadEquipos: 2, descripcion: 'revisión',
    });
    expect(db.leads()).toHaveLength(antes + 1);
  });

  it('aceptarOt no permite un técnico bloqueado y asigna con uno disponible', () => {
    expect(() => db.aceptarOt('OT-2026-001', 'TEC-002')).toThrow();
    expect(db.aceptarOt('OT-2026-001', 'TEC-001').estado).toBe('ASIGNADA');
  });

  it('subirDocumentoTecnico agrega un documento', () => {
    const antes = db.tecnicos().find((t) => t.id === 'TEC-001')?.documentos?.length ?? 0;
    db.subirDocumentoTecnico('TEC-001', 'RUT', 'http://doc');
    expect(db.tecnicos().find((t) => t.id === 'TEC-001')?.documentos).toHaveLength(antes + 1);
  });
});
