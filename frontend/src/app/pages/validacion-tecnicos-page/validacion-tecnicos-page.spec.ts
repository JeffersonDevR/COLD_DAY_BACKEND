import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of, Subject, throwError } from 'rxjs';
import { ValidacionTecnicosPage } from './validacion-tecnicos-page';
import { AdminApi } from '../../core/service/admin-api';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ESPERA_RECARGA_ADMIN_MS } from '../../core/service/admin-actividad-refresco';
import { AdminActividad, SseService } from '../../core/service/sse.service';
import { ToastService } from '../../core/alertas/toast.service';
import { ApiHttpError } from '../../core/interceptos/error.interceptor';
import { Rol, TecnicoResponse } from '../../core/models/common.models';
import { AuthService } from '../../core/service/auth.service';

interface CanalAdmin {
  abrirAdminStream: ReturnType<typeof vi.fn>;
}

function actividad(tipo: AdminActividad['tipo']): AdminActividad {
  return { tipo, id: 'x-1', ocurridaEn: '2026-10-30T10:00:00Z' };
}

/** Canal admin falso: permite empujar actividad sin abrir un EventSource. */
function canalAdmin() {
  const eventos = new Subject<AdminActividad>();
  return { eventos, sse: { abrirAdminStream: vi.fn(() => eventos.asObservable()) } };
}

const tecnico: TecnicoResponse = {
  id: 'TEC-1',
  nombre: 'Juan Pérez',
  nombreCompleto: 'Juan Pérez',
  correo: 'j@x.co',
  telefono: '300',
  cedula: '123',
  categorias: ['REFRIGERACION'],
  estadoValidacion: 'EN_REVISION',
  documentos: [{ id: 'DOC-1', tipo: 'CEDULA', nombre: 'cedula.pdf', estadoValidacion: 'PENDIENTE' }],
};

/** Mensaje humano esperado para el 409 de documentación incompleta/vencida. */
const MENSAJE_409 =
  'El expediente del técnico no está completo o tiene documentos vencidos. Pídele que actualice la documentación antes de validarlo.';

function setup(
  validarError?: unknown,
  getTecnicos?: ReturnType<typeof vi.fn>,
  sse?: CanalAdmin,
  getDocumentos: ReturnType<typeof vi.fn> = vi.fn(() => of(tecnico.documentos)),
  rol: Rol = 'ADMINISTRADOR',
) {
  const adminApi = {
    validarDocumentacionTecnico: vi.fn(() =>
      validarError ? throwError(() => validarError) : of(undefined)
    ),
  };
  const tecnicosApi = { getTecnicos: getTecnicos ?? vi.fn(() => of([tecnico])), getDocumentos };
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ValidacionTecnicosPage],
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: adminApi },
      { provide: AuthService, useValue: { userRoles: () => new Set<Rol>([rol]) } },
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
      // Sin canal explícito, el stream se completa vacío: la degradación real.
      { provide: SseService, useValue: sse ?? { abrirAdminStream: () => EMPTY } },
    ],
  });
  const fixture = TestBed.createComponent(ValidacionTecnicosPage);
  fixture.detectChanges();
  return { fixture, adminApi, tecnicosApi, toast };
}

describe('ValidacionTecnicosPage', () => {
  it('carga los técnicos al iniciar', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance.tecnicos().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Juan Pérez');
  });

  it('no ofrece volver a la Torre de Control a quien no puede abrirla', () => {
    const rrhh = setup(undefined, undefined, undefined, undefined, 'RECURSOS_HUMANOS');
    expect(rrhh.fixture.nativeElement.textContent).not.toContain('Torre de Control');
    TestBed.resetTestingModule();

    expect(setup().fixture.nativeElement.textContent).toContain('Volver a la Torre de Control');
  });

  describe('documentos declarados', () => {
    const conFechas = {
      id: 'DOC-9', tipo: 'RUT' as const, nombre: 'RUT', estadoValidacion: 'APROBADO' as const,
      fechaExpedicion: '2026-01-10', fechaVencimiento: '2027-01-10',
    };

    it('muestra tipo y fechas de lo que declaró cada pendiente, sin enlace a un archivo', () => {
      const getDocumentos = vi.fn(() => of([conFechas]));
      const { fixture } = setup(undefined, undefined, undefined, getDocumentos);

      const texto = fixture.nativeElement.textContent;
      expect(getDocumentos).toHaveBeenCalledWith('TEC-1');
      expect(texto).toContain('RUT');
      expect(texto).toContain('Expide: 2026-01-10');
      expect(texto).toContain('Vence: 2027-01-10');
      expect(fixture.nativeElement.querySelector('a[target="_blank"]')).toBeNull();
    });

    it('dice cuándo no declaró ninguno', () => {
      const { fixture } = setup(undefined, undefined, undefined, vi.fn(() => of([])));

      expect(fixture.nativeElement.textContent).toContain('No ha declarado documentos.');
    });

    it('distingue un fallo de carga y deja reintentar', () => {
      const getDocumentos = vi.fn()
        .mockReturnValueOnce(throwError(() => new Error('sin red')))
        .mockReturnValue(of([conFechas]));
      const { fixture } = setup(undefined, undefined, undefined, getDocumentos);
      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los documentos.');
      expect(fixture.nativeElement.textContent).not.toContain('No ha declarado documentos.');

      const reintentar = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement;
      reintentar.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Vence: 2027-01-10');
    });
  });

  it('un técnico ya aprobado sale de la bandeja y solo quedan los pendientes', () => {
    const aprobado: TecnicoResponse = {
      ...tecnico,
      id: 'TEC-2',
      nombre: 'Ana Gómez',
      nombreCompleto: 'Ana Gómez',
      estadoValidacion: 'APROBADO',
    };
    const { fixture } = setup(undefined, vi.fn(() => of([aprobado, tecnico])));

    const texto = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Ana Gómez');
    expect(texto).toContain('Juan Pérez');
    expect(fixture.componentInstance.pendientes().map((t) => t.id)).toEqual(['TEC-1']);
  });

  it('avisa si los expedientes no cargan y reintenta', () => {
    const getTecnicos = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(of([tecnico]));
    const { fixture } = setup(undefined, getTecnicos);

    expect(fixture.componentInstance.errorCarga()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los expedientes técnicos.');

    (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getTecnicos).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.errorCarga()).toBe(false);
    expect(fixture.componentInstance.tecnicos().length).toBe(1);
  });

  it('aprueba y habilita al técnico', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.aprobar(tecnico);
    expect(adminApi.validarDocumentacionTecnico).toHaveBeenCalledWith('TEC-1', 'APROBADO');
    expect(toast.success).toHaveBeenCalled();
  });

  it('confirma el rechazo con motivo', () => {
    const { fixture, adminApi, toast } = setup();
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('documentos vencidos');

    fixture.componentInstance.confirmarRechazo();

    expect(adminApi.validarDocumentacionTecnico).toHaveBeenCalledWith('TEC-1', 'RECHAZADO', 'documentos vencidos');
    expect(toast.warning).toHaveBeenCalled();
    expect(fixture.componentInstance.tecnicoARechazar()).toBeNull();
  });

  it('no rechaza sin motivo válido', () => {
    const { fixture, adminApi } = setup();
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('x');

    fixture.componentInstance.confirmarRechazo();

    expect(adminApi.validarDocumentacionTecnico).not.toHaveBeenCalled();
  });

  it('ante un 409 avisa con copy humana y deja la fila intacta (sin recargar)', () => {
    const { fixture, tecnicosApi, toast } = setup(
      new ApiHttpError('Documentacion incompleta o vencida del técnico TEC-1', 409)
    );

    fixture.componentInstance.aprobar(tecnico);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('No se pudo habilitar al técnico', MENSAJE_409);
    // Solo la carga inicial del constructor: el fallo no dispara refetch.
    expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.tecnicos().length).toBe(1);
  });

  it('ante un fallo del rechazo mantiene el modal y el motivo para reintentar', () => {
    const { fixture, tecnicosApi, toast } = setup(
      new ApiHttpError('Tecnico no encontrado: TEC-1', 404)
    );
    fixture.componentInstance.abrirModalRechazo(tecnico);
    fixture.componentInstance.motivoCtrl.setValue('documentos vencidos');

    fixture.componentInstance.confirmarRechazo();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo rechazar la validación',
      'El técnico ya no está registrado. Actualiza la lista e inténtalo de nuevo.'
    );
    expect(fixture.componentInstance.tecnicoARechazar()).not.toBeNull();
    expect(fixture.componentInstance.motivoCtrl.value).toBe('documentos vencidos');
    expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);
  });

  describe('actividad administrativa en tiempo real', () => {
    afterEach(() => vi.useRealTimers());

    it('recarga con una validación de técnico, después de la ventana de calma', () => {
      const { eventos, sse } = canalAdmin();
      const { tecnicosApi } = setup(undefined, undefined, sse);
      vi.useFakeTimers();

      eventos.next(actividad('TECNICO_VALIDADO'));
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(2);
    });

    it('ignora actividad que no es de validación', () => {
      const { eventos, sse } = canalAdmin();
      const { tecnicosApi } = setup(undefined, undefined, sse);
      vi.useFakeTimers();

      eventos.next(actividad('DISPUTA_RESUELTA'));
      eventos.next(actividad('LIQUIDACION_REGISTRADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(1);
    });

    it('una ráfaga de validaciones produce UNA sola recarga', () => {
      const { eventos, sse } = canalAdmin();
      const { tecnicosApi } = setup(undefined, undefined, sse);
      vi.useFakeTimers();

      eventos.next(actividad('TECNICO_VALIDADO'));
      eventos.next(actividad('TECNICO_VALIDACION_RECHAZADA'));
      eventos.next(actividad('TECNICO_VALIDADO'));

      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(2);
    });

    it('no solapa recargas: con una en vuelo deja UNA pendiente', () => {
      const enVuelo = new Subject<TecnicoResponse[]>();
      const getTecnicos = vi
        .fn()
        .mockReturnValueOnce(of([tecnico]))
        .mockReturnValueOnce(enVuelo.asObservable())
        .mockReturnValue(of([tecnico]));
      const { eventos, sse } = canalAdmin();
      const { tecnicosApi } = setup(undefined, getTecnicos, sse);
      vi.useFakeTimers();

      eventos.next(actividad('TECNICO_VALIDADO'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(2);

      // Llega más actividad mientras la recarga sigue en vuelo.
      eventos.next(actividad('TECNICO_VALIDACION_RECHAZADA'));
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);
      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(2);

      // Al terminar, recién ahí corre la pendiente (una sola).
      enVuelo.next([tecnico]);
      enVuelo.complete();
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(tecnicosApi.getTecnicos).toHaveBeenCalledTimes(3);
    });

    it('al destruir la pantalla no queda un refresco pendiente', () => {
      const getTecnicos = vi.fn(() => of([tecnico]));
      const { eventos, sse } = canalAdmin();
      const { fixture } = setup(undefined, getTecnicos, sse);
      vi.useFakeTimers();

      eventos.next(actividad('TECNICO_VALIDADO'));
      fixture.destroy();
      vi.advanceTimersByTime(ESPERA_RECARGA_ADMIN_MS);

      expect(getTecnicos).toHaveBeenCalledTimes(1);
    });
  });
});
