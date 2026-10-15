import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OfertasPage } from './ofertas-page';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { OfertaTecnicoResponse, OtResponse, TecnicoResponse } from '../../core/models/common.models';
import { POLL_INTERVAL_MS } from '../../core/service/visible-tab-polling';

/** Alterna `document.visibilityState` como lo haría el navegador al cambiar de pestaña. */
function cambiarPestana(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
}

const ot: OtResponse = {
  id: 'OT-1',
  codigo: 'OT-2026-0042',
  categoriaServicio: 'REFRIGERACION',
  descripcionFalla: 'no enfría',
  estado: 'BUSCANDO_TECNICO',
  auxiliaresRequeridos: 0,
};

const oferta: OfertaTecnicoResponse = {
  id: 'OF-1',
  otId: 'OT-1',
  ot,
  tecnicoId: 'TEC-1',
  distanciaKm: 2,
  radioVigenteKm: 10,
  segundosRestantes: 42,
  estado: 'PENDIENTE',
  fechaCreacion: '2026-01-01T00:00:00Z',
};

function setup(tecnico: TecnicoResponse | undefined) {
  const tecnicosApi = {
    getMiPerfil: vi.fn(() => of(tecnico)),
    getOfertasParaTecnico: vi.fn(() => of([oferta])),
    aceptarOferta: vi.fn(() => of(true)),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [OfertasPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(OfertasPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast, navigate };
}

describe('OfertasPage', () => {
  it('carga ofertas al resolver el perfil del técnico', () => {
    const { fixture, tecnicosApi } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledWith('TEC-1');
    expect(fixture.componentInstance.solicitudesDisponibles().length).toBe(1);
    // La tarjeta se identifica por el código de la OT, no por su id interno
    // ni por el id de la oferta.
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('OT-2026-0042');
    expect(texto).not.toContain('OT-1');
    expect(texto).not.toContain('OF-1');
  });

  it('acepta la oferta y navega a ejecución', () => {
    const { fixture, tecnicosApi, toast, navigate } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).toHaveBeenCalledWith('OF-1', 'TEC-1', 0);
    expect(toast.success).toHaveBeenCalledWith(
      '¡Servicio Asignado!',
      'Has tomado la orden OT-2026-0042. Se notificó al cliente la tarifa de visita + diagnóstico por distancia. Desplázate al domicilio.',
    );
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ejecucion', 'OT-1']);
    expect(fixture.componentInstance.loadingOt()).toBeNull();
  });

  it('sin código de OT, el aviso usa el fallback y no el id interno', () => {
    const { fixture, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });

    fixture.componentInstance.aceptarOferta({ ...ot, codigo: undefined });

    expect(toast.success).toHaveBeenCalledWith('¡Servicio Asignado!', expect.stringContaining('Sin código'));
    expect(toast.success).not.toHaveBeenCalledWith('¡Servicio Asignado!', expect.stringContaining('OT-1'));
  });

  it('bloquea la aceptación si el técnico está bloqueado', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'BLOQUEADO_POR_LIQUIDACION' });

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Operación Bloqueada', expect.any(String));
  });

  it('avisa si no hay oferta vigente para la OT', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    fixture.componentInstance.ofertas.set([]);

    fixture.componentInstance.aceptarOferta(ot);

    expect(tecnicosApi.aceptarOferta).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Sin Oferta Vigente',
      'No hay una oferta activa para la orden OT-2026-0042. Puede que ya haya sido tomada.',
    );
  });

  it('reporta error de concurrencia al fallar la aceptación', () => {
    const { fixture, tecnicosApi, toast } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
    tecnicosApi.aceptarOferta.mockReturnValue(throwError(() => new Error('409')));

    fixture.componentInstance.aceptarOferta(ot);

    expect(toast.error).toHaveBeenCalledWith('Error de Concurrencia', expect.any(String));
  });

  it('reporta error si no se carga el perfil', () => {
    const tecnicosApi = {
      getMiPerfil: vi.fn(() => throwError(() => new Error('sin red'))),
      getOfertasParaTecnico: vi.fn(),
      aceptarOferta: vi.fn(),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [OfertasPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
        { provide: TecnicosApi, useValue: tecnicosApi },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(OfertasPage);
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledWith('Error', expect.any(String));
  });

  describe('refresco periódico con la pestaña visible', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('refresca las ofertas una vez por intervalo', () => {
      cambiarPestana('visible');
      const { tecnicosApi } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });
      expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledTimes(2);
    });

    it('no consulta mientras la pestaña está oculta', () => {
      cambiarPestana('hidden');
      const { tecnicosApi } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledTimes(1);
    });

    it('no consulta si el técnico todavía no está resuelto', () => {
      cambiarPestana('visible');
      const { tecnicosApi } = setup(undefined);

      vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);

      expect(tecnicosApi.getOfertasParaTecnico).not.toHaveBeenCalled();
    });

    it('deja de refrescar al destruirse la página', () => {
      cambiarPestana('visible');
      const { fixture, tecnicosApi } = setup({ id: 'TEC-1', nombre: 'Juan', correo: 'j@x.co', estadoOperativo: 'DISPONIBLE' });

      fixture.destroy();
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);

      expect(tecnicosApi.getOfertasParaTecnico).toHaveBeenCalledTimes(1);
    });
  });
});
