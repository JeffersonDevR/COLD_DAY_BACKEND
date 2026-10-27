import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SolicitudDraft, SolicitudDraftService } from './solicitud-draft.service';

function borrador(overrides: Partial<SolicitudDraft> = {}): SolicitudDraft {
  return {
    categoria: 'REFRIGERACION',
    descripcion: 'El compresor hace ruido y no enfría.',
    direccion: 'Calle 15 # 3E-28, Caobos',
    coordenadas: { latitud: 7.9, longitud: -72.49 },
    evidenciaUrl: 'https://ejemplo.com/foto.jpg',
    actualizadoEn: '2026-10-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('SolicitudDraftService', () => {
  let usuarioId: number | null;

  beforeEach(() => {
    window.sessionStorage.clear();
    usuarioId = 7;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: () => (usuarioId == null ? null : { id: usuarioId }) },
        },
      ],
    });
  });

  const service = (): SolicitudDraftService => TestBed.inject(SolicitudDraftService);

  it('guarda y restaura el borrador completo', () => {
    const draft = borrador();
    service().guardar(draft);
    expect(service().leer()).toEqual(draft);
  });

  it('no restaura el borrador de otro usuario', () => {
    service().guardar(borrador());

    usuarioId = 8;

    expect(service().leer()).toBeNull();
  });

  it('limpiar borra el borrador del usuario actual', () => {
    const draftService = service();
    draftService.guardar(borrador());
    draftService.limpiar();
    expect(draftService.leer()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('ignora un valor corrupto en vez de romper el arranque', () => {
    window.sessionStorage.setItem('coldday.solicitud.borrador.7', '{no-es-json');
    expect(service().leer()).toBeNull();
  });

  it('sin sesión no persiste ni lee nada', () => {
    usuarioId = null;
    service().guardar(borrador());
    expect(window.sessionStorage.length).toBe(0);
    expect(service().leer()).toBeNull();
  });
});
