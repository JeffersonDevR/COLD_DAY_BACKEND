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
