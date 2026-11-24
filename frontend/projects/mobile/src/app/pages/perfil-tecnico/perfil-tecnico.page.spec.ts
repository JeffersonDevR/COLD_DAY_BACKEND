import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of } from 'rxjs';
import { DocumentoTecnico, TecnicoResponse } from '@core/models/common.models';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { MobileToastService } from '../../core/toast.service';
import { PerfilTecnicoPage } from './perfil-tecnico.page';

type Stub = ReturnType<typeof vi.fn>;

function tecnico(overrides: Partial<TecnicoResponse> = {}): TecnicoResponse {
  return {
    id: 'tec-1',
    nombre: 'Lucas Vega',
    numeroIdentificacion: '1098765001',
    correo: 'lucas@coldday.com',
    estadoValidacion: 'APROBADO',
    categoriasServicio: ['AIRE_ACONDICIONADO'],
    ...overrides,
  };
}

function setup({
  perfil = tecnico(),
  documentos = [] as DocumentoTecnico[],
  actualizar,
}: {
  perfil?: TecnicoResponse;
  documentos?: DocumentoTecnico[];
  actualizar?: Stub;
} = {}) {
  const api = {
    getMiPerfil: vi.fn(() => of(perfil)),
    getMisDocumentos: vi.fn(() => of(documentos)),
    actualizarMisEspecialidades: actualizar ?? vi.fn(() => of(tecnico({ categoriasServicio: ['AIRE_ACONDICIONADO', 'REFRIGERACION'] }))),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [PerfilTecnicoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: api },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const fixture: ComponentFixture<PerfilTecnicoPage> = TestBed.createComponent(PerfilTecnicoPage);
  fixture.detectChanges();
  return { fixture, api, toast };
}

function texto(fixture: ComponentFixture<PerfilTecnicoPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('PerfilTecnicoPage (B4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra los datos y el estado de validación', () => {
    const { fixture } = setup();
    expect(texto(fixture)).toContain('Lucas Vega');
    expect(texto(fixture)).toContain('lucas@coldday.com');
    expect(fixture.nativeElement.querySelector('[data-testid="estado-validacion"]').textContent).toContain('Aprobado');
  });

  it('no permite guardar sin cambios', () => {
    const { fixture } = setup();
    const boton = fixture.nativeElement.querySelector('[data-testid="guardar-especialidades"]') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  it('guarda las especialidades en el orden canónico', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.toggleCategoria('REFRIGERACION');
    fixture.detectChanges();
    fixture.componentInstance.guardar();
    expect(api.actualizarMisEspecialidades).toHaveBeenCalledWith([
      'REFRIGERACION',
      'AIRE_ACONDICIONADO',
    ], undefined);
  });

  it('pide la cédula mientras falta y no deja guardar sin ella', () => {
    const { fixture, api } = setup({ perfil: tecnico({ numeroIdentificacion: undefined }) });
    expect(fixture.nativeElement.querySelector('[data-testid="campo-cedula"]')).toBeTruthy();

    fixture.componentInstance.toggleCategoria('REFRIGERACION');
    fixture.detectChanges();
    fixture.componentInstance.guardar();

    expect(api.actualizarMisEspecialidades).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="cedula-error"]')).toBeTruthy();
  });

  it('envía la cédula junto con las especialidades cuando falta', () => {
    const { fixture, api } = setup({ perfil: tecnico({ numeroIdentificacion: undefined }) });
    fixture.componentInstance.cedula.set(' 1098765001 ');
    fixture.detectChanges();
    fixture.componentInstance.guardar();

    expect(api.actualizarMisEspecialidades).toHaveBeenCalledWith(['AIRE_ACONDICIONADO'], '1098765001');
  });

  it('no vuelve a pedir la cédula una vez guardada', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('[data-testid="campo-cedula"]')).toBeNull();
  });

  it('bloquea guardar sin ninguna especialidad', () => {
    const { fixture, api } = setup();
    fixture.componentInstance.toggleCategoria('AIRE_ACONDICIONADO');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="especialidad-error"]')).toBeTruthy();
    fixture.componentInstance.guardar();
    expect(api.actualizarMisEspecialidades).not.toHaveBeenCalled();
  });

  it('no repite aquí los documentos: viven en el tab Gestión, sin párrafo explicativo', () => {
    const { fixture } = setup();
    expect(texto(fixture)).not.toContain('tab Gestión');
    expect(fixture.nativeElement.querySelector('[data-testid="documentos-vacio"]')).toBeNull();
  });

  it('cuenta las especialidades elegidas sobre el total', () => {
    const { fixture } = setup();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="especialidades-conteo"]')
        ?.textContent?.trim(),
    ).toContain('1 de 5 elegidas');
  });

  it('usa las etiquetas canónicas de categorías', () => {
    const { fixture } = setup();
    const page = fixture.componentInstance;

    expect(page.etiquetaCategoria('LAVADORAS')).toBe('Lavadoras');
    expect(page.etiquetaCategoria('CAMARAS_VIGILANCIA')).toBe('Cámaras de vigilancia');
  });
});
