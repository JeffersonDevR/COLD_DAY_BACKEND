import { OfertaInsumoApiResponse, SolicitudInsumoApiResponse } from './backend.dto';
import { aOfertaInsumoResponse, aSolicitudInsumoResponse } from './backend.mappers';

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
