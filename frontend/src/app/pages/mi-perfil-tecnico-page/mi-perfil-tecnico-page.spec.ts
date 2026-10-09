import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MiPerfilTecnicoPage } from './mi-perfil-tecnico-page';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ToastService } from '../../core/alertas/toast.service';
import { CategoriaServicio, TecnicoResponse } from '../../core/models/common.models';

const tecnico: TecnicoResponse = {
  id: 'TEC-1',
  nombre: 'Juan Pérez',
  nombreCompleto: 'Juan Pérez',
  correo: 'juan.tecnico@coldday.com.co',
  numeroIdentificacion: '1090456789',
  telefono: '3001234567',
  categoriasServicio: ['REFRIGERACION'],
  estadoValidacion: 'APROBADO',
};

function setup(opts: { tecnico?: TecnicoResponse } = {}) {
  const tecnicosApi = {
    getMiPerfil: vi.fn(() => of(opts.tecnico ?? tecnico)),
    actualizarMisEspecialidades: vi.fn((categorias: CategoriaServicio[]) =>
      of({ ...(opts.tecnico ?? tecnico), categoriasServicio: categorias }),
    ),
  };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  TestBed.configureTestingModule({
    imports: [MiPerfilTecnicoPage],
    providers: [
      provideRouter([]),
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: ToastService, useValue: toast },
    ],
  });
  const fixture = TestBed.createComponent(MiPerfilTecnicoPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, toast };
}

/** Botón de guardado por su texto visible. */
function botonGuardar(fixture: { nativeElement: HTMLElement }): HTMLButtonElement | undefined {
  const botones = Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button'));
  return botones.find((b) => b.textContent?.includes('Guardar Especialidades'));
}

describe('MiPerfilTecnicoPage', () => {
  it('muestra el nombre completo y el correo del técnico cargado', () => {
    const { fixture } = setup();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Juan Pérez');
    expect(texto).toContain('juan.tecnico@coldday.com.co');
    expect(texto).toContain('1090456789');
  });

  it('alterna una categoría: la agrega y luego la quita', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance;
    expect(page.estaSeleccionada('ELECTRICIDAD')).toBe(false);

    page.toggleCategoria('ELECTRICIDAD');
    expect(page.estaSeleccionada('ELECTRICIDAD')).toBe(true);

    page.toggleCategoria('ELECTRICIDAD');
    expect(page.estaSeleccionada('ELECTRICIDAD')).toBe(false);
  });

  it('deshabilita el guardado y no llama a la API cuando la selección queda vacía', () => {
    const { fixture, tecnicosApi } = setup();
    const page = fixture.componentInstance;

    // Quita la única especialidad cargada.
    page.toggleCategoria('REFRIGERACION');
    fixture.detectChanges();

    expect(page.seleccionVacia()).toBe(true);
    expect(botonGuardar(fixture)?.disabled).toBe(true);

    page.guardar();
    expect(tecnicosApi.actualizarMisEspecialidades).not.toHaveBeenCalled();
  });

  it('guarda las especialidades seleccionadas y avisa el éxito', () => {
    const { fixture, tecnicosApi, toast } = setup();
    const page = fixture.componentInstance;

    page.toggleCategoria('ELECTRICIDAD');
    page.guardar();

    expect(tecnicosApi.actualizarMisEspecialidades).toHaveBeenCalledTimes(1);
    expect(tecnicosApi.actualizarMisEspecialidades.mock.calls[0][0]).toEqual([
      'REFRIGERACION',
      'ELECTRICIDAD',
    ]);
    expect(toast.success).toHaveBeenCalled();
    expect(page.hayCambios()).toBe(false);
  });

  it('expone el error de la API y conserva la selección', () => {
    const { fixture, tecnicosApi, toast } = setup();
    const page = fixture.componentInstance;

    tecnicosApi.actualizarMisEspecialidades.mockReturnValue(
      throwError(() => new Error('Debes conservar al menos una especialidad')),
    );

    page.toggleCategoria('ELECTRICIDAD');
    page.guardar();

    expect(toast.error).toHaveBeenCalledWith(
      'No se pudieron guardar las especialidades',
      'Debes conservar al menos una especialidad',
    );
    expect(page.estaSeleccionada('REFRIGERACION')).toBe(true);
    expect(page.estaSeleccionada('ELECTRICIDAD')).toBe(true);
    expect(page.guardando()).toBe(false);
  });
});
