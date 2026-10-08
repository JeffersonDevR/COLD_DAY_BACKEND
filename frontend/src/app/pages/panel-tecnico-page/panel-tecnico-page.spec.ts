import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PanelTecnicoPage } from './panel-tecnico-page';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { TecnicoTrackingService } from '../../core/service/tecnico-tracking.service';
import { ToastService } from '../../core/alertas/toast.service';
import { OtResponse, TecnicoResponse } from '../../core/models/common.models';

const tecnico: TecnicoResponse = {
  id: 'TEC-1',
  nombre: 'Juan',
  nombreCompleto: 'Juan Pérez',
  correo: 'j@x.co',
  estadoOperativo: 'DISPONIBLE',
  deudaComisionCop: 0,
};

function tecnicoCon(overrides: Partial<TecnicoResponse>): TecnicoResponse {
  return { ...tecnico, ...overrides };
}

function ot(id: string, estado: OtResponse['estado']): OtResponse {
  return { id, categoriaServicio: 'REFRIGERACION', descripcionFalla: 'x', estado, auxiliaresRequeridos: 0 };
}

function setup(opts: {
  tecnico?: TecnicoResponse | undefined;
  ots?: OtResponse[];
  trackingActivo?: boolean;
  trackingMotivo?: string | null;
} = {}) {
  const tecnicosApi = {
    getMiPerfil: vi.fn(() => of(opts.tecnico ?? tecnico)),
    getMisOts: vi.fn(() => of(opts.ots ?? [ot('a', 'EN_CAMINO'), ot('b', 'FINALIZADA')])),
    actualizarEstadoOperativo: vi.fn(() => of(true)),
  };
  const tracking = {
    activo: signal(opts.trackingActivo ?? false),
    motivo: signal(opts.trackingMotivo ?? null),
    ultimaPosicion: signal(null),
    iniciar: vi.fn(),
    detener: vi.fn(),
  };
  const toast = { info: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [PanelTecnicoPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => ({ id: 6 }) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: TecnicoTrackingService, useValue: tracking },
      { provide: ToastService, useValue: toast },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PanelTecnicoPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast, navigate, tracking };
}

describe('PanelTecnicoPage', () => {
  it('carga el técnico y filtra las OTs en curso', () => {
    const { fixture, tecnicosApi } = setup();
    expect(tecnicosApi.getMisOts).toHaveBeenCalled();
    expect(fixture.componentInstance.misOtsEnCurso().map((o) => o.id)).toEqual(['a']);
  });

  it('cambia el estado operativo y avisa', () => {
    const { fixture, tecnicosApi, toast } = setup();
    fixture.componentInstance.cambiarEstadoOperativo('FUERA_DE_SERVICIO');
    // Sin id: /api/tecnicos/me/estado resuelve el técnico desde el principal.
    expect(tecnicosApi.actualizarEstadoOperativo).toHaveBeenCalledWith('FUERA_DE_SERVICIO');
    expect(fixture.componentInstance.tecnico()?.estadoOperativo).toBe('FUERA_DE_SERVICIO');
    expect(toast.info).toHaveBeenCalled();
  });

  it('muestra error si el backend rechaza el cambio de estado', () => {
    const { fixture, tecnicosApi, toast } = setup();
    tecnicosApi.actualizarEstadoOperativo.mockReturnValue(throwError(() => new Error('OT activa')));
    fixture.componentInstance.cambiarEstadoOperativo('DISPONIBLE');
    expect(toast.error).toHaveBeenCalledWith('No se pudo cambiar el estado', 'OT activa');
  });

  it('navega al radar de ofertas', () => {
    const { fixture, navigate } = setup();
    fixture.componentInstance.irAOfertas();
    expect(navigate).toHaveBeenCalledWith(['/tecnico/ofertas']);
  });

  it('muestra el estado vacío sin servicios asignados', () => {
    const { fixture } = setup({ ots: [] });
    expect(fixture.nativeElement.textContent).toContain('No tienes servicios asignados');
  });

  it('muestra el estado de validación real sin inventar APROBADO', () => {
    const { fixture } = setup({ tecnico: tecnicoCon({ estadoValidacion: 'PENDIENTE' }) });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('PENDIENTE');
    expect(texto).not.toContain('APROBADO');
    expect(texto).toContain('en revisión');
  });

  it('expone el motivo de rechazo cuando la cuenta fue rechazada', () => {
    const { fixture } = setup({
      tecnico: tecnicoCon({
        estadoValidacion: 'RECHAZADO',
        motivoRechazoValidacion: 'Cédula ilegible',
      }),
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('RECHAZADO');
    expect(texto).toContain('Cédula ilegible');
  });

  it('la tarjeta de radar indica el requisito bloqueante', () => {
    const { fixture } = setup({
      tecnico: tecnicoCon({ estadoValidacion: 'PENDIENTE', estadoOperativo: 'FUERA_DE_SERVICIO' }),
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Visibilidad en el radar');
    expect(texto).toContain('no aparecerás en el radar');
    expect(texto).toContain('un administrador debe aprobar tu cuenta');
    expect(texto).toContain('debes estar DISPONIBLE');
  });

  it('la tarjeta reporta la ubicación no reportada y su motivo', () => {
    const { fixture } = setup({
      tecnico: tecnicoCon({ estadoValidacion: 'APROBADO' }),
      trackingActivo: false,
      trackingMotivo: 'Permiso de ubicación denegado. Habilítalo en el navegador para continuar.',
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Permiso de ubicación denegado');
  });

  it('la tarjeta muestra el estado positivo cuando todo está en orden', () => {
    const { fixture } = setup({
      tecnico: tecnicoCon({ estadoValidacion: 'APROBADO', estadoOperativo: 'DISPONIBLE' }),
      trackingActivo: true,
      trackingMotivo: null,
    });
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Los clientes pueden encontrarte en el radar de cercanos');
  });
});
