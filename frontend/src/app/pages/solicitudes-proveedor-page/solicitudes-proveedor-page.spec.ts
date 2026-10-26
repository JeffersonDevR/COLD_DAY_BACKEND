import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SolicitudesProveedorPage } from './solicitudes-proveedor-page';
import { ProveedoresApi } from '../../core/service/proveedores-api';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { OfertaInsumoResponse, SolicitudInsumoResponse } from '../../core/models/common.models';

function requerimiento(overrides: Partial<SolicitudInsumoResponse> = {}): SolicitudInsumoResponse {
  return {
    id: 'REQ-1',
    otId: 'OT-2026-002',
    tecnicoId: 'TEC-001',
    estado: 'SOLICITADO',
    observaciones: 'Entrega en sitio durante la visita del técnico.',
    items: [{ descripcion: 'Bimetálico universal L55', cantidad: 1 }],
    creadaEn: '2026-09-15T09:40:00Z',
    ...overrides,
  };
}

function oferta(overrides: Partial<OfertaInsumoResponse> = {}): OfertaInsumoResponse {
  return {
    id: 'OFERTA-1',
    requerimientoId: 'REQ-1',
    proveedorId: 'PROV-001',
    estado: 'PENDIENTE',
    creadaEn: '2026-09-15T09:40:00Z',
    expiraEn: '2026-09-15T09:55:00Z',
    requerimiento: requerimiento(),
    ...overrides,
  };
}

function setup(opts: { ofertas?: OfertaInsumoResponse[]; falloCarga?: ApiHttpError } = {}) {
  const proveedoresApi = {
    getMisSolicitudes: opts.falloCarga
      ? vi.fn(() => throwError(() => opts.falloCarga))
      : vi.fn(() => of(opts.ofertas ?? [oferta()])),
    aceptar: vi.fn(() => of(requerimiento({ estado: 'ASIGNADO' }))),
    rechazar: vi.fn(() => of(oferta({ estado: 'RECHAZADO' }))),
    entregar: vi.fn(() => of(requerimiento({ estado: 'ENTREGADO' }))),
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    imports: [SolicitudesProveedorPage],
    providers: [
      provideRouter([]),
      { provide: ProveedoresApi, useValue: proveedoresApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(SolicitudesProveedorPage);
  fixture.detectChanges();
  return { fixture, proveedoresApi, toast };
}

describe('SolicitudesProveedorPage', () => {
  it('carga las solicitudes y renderiza requerimiento, líneas y observaciones', () => {
    const { fixture } = setup();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Solicitudes de Insumos');
    expect(texto).toContain('Pendiente');
    expect(texto).toContain('Estado del requerimiento:');
    expect(texto).toContain('Bimetálico universal L55');
    expect(texto).toContain('Entrega en sitio durante la visita del técnico.');
    expect(fixture.componentInstance.ofertas()).toHaveLength(1);
  });

  it('lista vacía muestra el estado vacío, no un error', () => {
    const { fixture } = setup({ ofertas: [] });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('No tienes solicitudes de insumos');
    expect(fixture.componentInstance.errorCarga()).toBe(false);
  });

  it('aceptar asigna el requerimiento y recarga las solicitudes', () => {
    const { fixture, proveedoresApi, toast } = setup();
    fixture.componentInstance.aceptar(fixture.componentInstance.ofertas()[0]);

    expect(proveedoresApi.aceptar).toHaveBeenCalledWith('OFERTA-1');
    expect(toast.success).toHaveBeenCalledWith(
      'Solicitud aceptada',
      'Te asignamos el requerimiento. Coordina la entrega en el sitio del técnico.',
    );
    // La carga inicial + la recarga tras la acción.
    expect(proveedoresApi.getMisSolicitudes).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.accionEnCurso()).toBeNull();
  });

  it('rechazar registra el rechazo sin vincular al proveedor', () => {
    const { fixture, proveedoresApi, toast } = setup();
    fixture.componentInstance.rechazar(fixture.componentInstance.ofertas()[0]);

    expect(proveedoresApi.rechazar).toHaveBeenCalledWith('OFERTA-1');
    expect(toast.info).toHaveBeenCalledWith(
      'Solicitud rechazada',
      'Se registró tu rechazo. No quedas vinculado a esta entrega.',
    );
  });

  it('entregar usa el id del requerimiento embebido y confirma la entrega', () => {
    const { fixture, proveedoresApi, toast } = setup({
      ofertas: [oferta({ estado: 'ACEPTADA', requerimiento: requerimiento({ estado: 'ASIGNADO' }) })],
    });
    fixture.componentInstance.entregar(fixture.componentInstance.ofertas()[0]);

    // OJO: la entrega viaja por el requerimiento, no por la oferta.
    expect(proveedoresApi.entregar).toHaveBeenCalledWith('REQ-1');
    expect(toast.success).toHaveBeenCalledWith(
      'Entrega confirmada',
      'El requerimiento quedó marcado como ENTREGADO.',
    );
    expect(fixture.componentInstance.accionEnCurso()).toBeNull();
  });

  it('un 409 de carrera perdida al aceptar se traduce a copy humana', () => {
    const { fixture, proveedoresApi, toast } = setup();
    proveedoresApi.aceptar.mockReturnValue(
      throwError(() => new ApiHttpError('race lost', 409)),
    );
    fixture.componentInstance.aceptar(fixture.componentInstance.ofertas()[0]);

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo aceptar',
      'Otra empresa tomó esta solicitud primero.',
    );
    expect(fixture.componentInstance.accionEnCurso()).toBeNull();
  });

  it('un 409 al rechazar avisa que la solicitud ya fue gestionada', () => {
    const { fixture, proveedoresApi, toast } = setup();
    proveedoresApi.rechazar.mockReturnValue(
      throwError(() => new ApiHttpError('gestionada', 409)),
    );
    fixture.componentInstance.rechazar(fixture.componentInstance.ofertas()[0]);

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo rechazar',
      'Esta solicitud ya fue gestionada por otro proveedor.',
    );
  });

  it('entregar sin requerimiento embebido no llama al backend', () => {
    const { fixture, proveedoresApi, toast } = setup({
      ofertas: [oferta({ estado: 'ACEPTADA', requerimiento: null })],
    });
    fixture.componentInstance.entregar(fixture.componentInstance.ofertas()[0]);

    expect(proveedoresApi.entregar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Sin requerimiento', expect.any(String));
  });

  it('un fallo de carga (500) muestra el aviso con reintentar', () => {
    const { fixture } = setup({
      falloCarga: new ApiHttpError('boom', 500),
    });
    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.componentInstance.validacionBloquea()).toBe(false);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('No se pudieron cargar las solicitudes');
    expect(texto).toContain('Reintentar');
  });

  it('un 403 de carga marca el gate de validación documental', () => {
    const { fixture } = setup({
      falloCarga: new ApiHttpError('documentación pendiente', 403),
    });
    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.componentInstance.validacionBloquea()).toBe(true);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('PENDIENTE');
    expect(texto).toContain('Ir a mi expediente');
  });
});
