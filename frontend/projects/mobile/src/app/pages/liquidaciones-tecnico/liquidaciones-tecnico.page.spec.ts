import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { DocumentoTecnico, LiquidacionResponse, TecnicoResponse } from '@core/models/common.models';
import { LiquidacionApi } from '@core/service/liquidacion-api';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { MobileToastService } from '../../core/toast.service';
import { LiquidacionesTecnicoPage } from './liquidaciones-tecnico.page';

function liquidacion(overrides: Partial<LiquidacionResponse> = {}): LiquidacionResponse {
  return {
    id: 'L-1',
    otId: 'OT-UUID',
    otCodigo: 'OT-2026-0001',
    tecnicoId: 'T-1',
    montoServicio: 100_000,
    comision: 15_000,
    estado: 'PENDIENTE_CONSIGNACION',
    medioPago: 'EFECTIVO',
    fechaRegistro: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

function setup({
  lista = [] as LiquidacionResponse[],
  falla = false,
  sinPerfil = false,
  documentos = [] as DocumentoTecnico[],
} = {}) {
  const tecnicosApi = {
    getMiPerfil: vi.fn(() =>
      sinPerfil ? of(undefined) : of({ id: 'T-1' } as TecnicoResponse),
    ),
    getMisDocumentos: vi.fn(() => of(documentos)),
    subirDocumento: vi.fn(() => of(undefined)),
  };
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const liquidacionApi = {
    getLiquidacionesPorTecnico: vi.fn(() =>
      falla ? throwError(() => new Error('sin red')) : of(lista),
    ),
  };

  TestBed.configureTestingModule({
    imports: [LiquidacionesTecnicoPage],
    providers: [
      provideIonicAngular(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TecnicosApi, useValue: tecnicosApi },
      { provide: LiquidacionApi, useValue: liquidacionApi },
      { provide: MobileToastService, useValue: toast },
    ],
  });

  const fixture: ComponentFixture<LiquidacionesTecnicoPage> =
    TestBed.createComponent(LiquidacionesTecnicoPage);
  fixture.detectChanges();
  return { fixture, tecnicosApi, liquidacionApi, toast };
}

function texto(fixture: ComponentFixture<LiquidacionesTecnicoPage>): string {
  return (fixture.nativeElement.textContent as string) ?? '';
}

describe('LiquidacionesTecnicoPage (B5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pide las liquidaciones del técnico autenticado, sin enviar un id', () => {
    const { liquidacionApi } = setup({ lista: [liquidacion()] });

    expect(liquidacionApi.getLiquidacionesPorTecnico).toHaveBeenCalledWith('T-1');
  });

  it('suma solo la comisión pendiente de consignar', () => {
    const { fixture } = setup({
      lista: [
        liquidacion({ id: 'L-1', comision: 15_000 }),
        liquidacion({ id: 'L-2', comision: 9_000 }),
        liquidacion({ id: 'L-3', estado: 'EN_VERIFICACION', comision: 30_000 }),
        liquidacion({ id: 'L-4', estado: 'APROBADA', comision: 12_000 }),
      ],
    });

    expect(fixture.componentInstance.porConsignar()).toBe(24_000);
    expect(texto(fixture)).toContain('24.000');
  });

  it('muestra el estado vacío cuando no hay liquidaciones', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('[data-testid="liquidaciones-vacio"]')).toBeTruthy();
  });

  it('lista cada liquidación con su código de OT y su comisión', () => {
    const { fixture } = setup({ lista: [liquidacion()] });

    const textoPantalla = texto(fixture);
    expect(textoPantalla).toContain('OT-2026-0001');
    expect(textoPantalla).toContain('15.000');
    expect(textoPantalla).toContain('Pendiente de consignación');
  });

  it('muestra el motivo cuando la liquidación fue rechazada', () => {
    const { fixture } = setup({
      lista: [
        liquidacion({
          id: 'L-9',
          estado: 'RECHAZADA',
          motivoRechazo: 'El comprobante no coincide con el monto.',
        }),
      ],
    });

    expect(texto(fixture)).toContain('El comprobante no coincide con el monto.');
  });

  it('ofrece reintentar cuando la carga falla', () => {
    const { fixture } = setup({ falla: true });

    expect(fixture.nativeElement.querySelector('[data-testid="liquidaciones-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="reintentar-liquidaciones"]')).toBeTruthy();
  });

  it('sin perfil de técnico el resultado es el estado de error, no una lista vacía silenciosa', () => {
    const { fixture } = setup({ sinPerfil: true });

    expect(fixture.componentInstance.fallo()).toBe(true);
  });

  it('agrupa los documentos con las liquidaciones (tab Gestión)', () => {
    const { fixture } = setup({
      documentos: [
        {
          id: 'd1',
          tipo: 'MATRICULA_CONTE',
          nombre: 'Matrícula CONTE',
          estadoValidacion: 'APROBADO',
        },
      ],
    });

    expect(texto(fixture)).toContain('Gestión');
    expect(texto(fixture)).toContain('Liquidaciones');
    expect(texto(fixture)).toContain('Documentos');
    expect(texto(fixture)).toContain('Matrícula CONTE');
    expect(texto(fixture)).not.toContain('Sube o renueva documentos desde la web.');
  });

  it('muestra el estado vacío de documentos', () => {
    const { fixture } = setup({ documentos: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="documentos-vacio"]')).toBeTruthy();
  });

  it('usa la etiqueta canónica del documento cuando no trae nombre', () => {
    const { fixture } = setup({
      documentos: [
        { id: 'd2', tipo: 'MATRICULA_CONTE', estadoValidacion: 'PENDIENTE' } as DocumentoTecnico,
      ],
    });
    expect(texto(fixture)).toContain('Matrícula CONTE');
  });

  it('cada liquidación es su propia tarjeta', () => {
    const { fixture } = setup({
      lista: [liquidacion({ id: 'L-1' }), liquidacion({ id: 'L-2' }), liquidacion({ id: 'L-3' })],
    });

    const tarjetas = [...fixture.nativeElement.querySelectorAll('[data-testid^="liquidacion-"]')] as HTMLElement[];
    expect(tarjetas).toHaveLength(3);
    for (const tarjeta of tarjetas) {
      expect(tarjeta.tagName).toBe('ARTICLE');
      expect(tarjeta.classList.contains('cd-card')).toBe(true);
      expect(tarjeta.classList.contains('cd-liq')).toBe(true);
    }
  });

  it('la comisión es el dato principal y la fecha y el medio van en la línea de meta', () => {
    const { fixture } = setup({ lista: [liquidacion({ id: 'L-1', comision: 22_500 })] });

    const comision = fixture.nativeElement.querySelector('[data-testid="comision-L-1"]') as HTMLElement;
    const meta = fixture.nativeElement.querySelector('[data-testid="meta-L-1"]') as HTMLElement;
    expect(comision.textContent).toContain('$ 22.500');
    expect(meta.textContent).toContain('2026');
    expect(meta.textContent).toContain('Efectivo');
  });

  it('la fecha no usa la clase que capitaliza (evita "10 De Oct")', () => {
    const { fixture } = setup({ lista: [liquidacion({ id: 'L-1' })] });

    const meta = fixture.nativeElement.querySelector('[data-testid="meta-L-1"]') as HTMLElement;
    expect(meta.classList.contains('cd-liq__meta')).toBe(true);
    expect(meta.classList.contains('cd-ot__categoria')).toBe(false);
  });

  it('una liquidación sin datos opcionales no pinta undefined ni Invalid Date', () => {
    const { fixture } = setup({
      lista: [
        liquidacion({
          id: 'L-5',
          otCodigo: undefined,
          medioPago: undefined as unknown as LiquidacionResponse['medioPago'],
          fechaRegistro: undefined as unknown as string,
        }),
      ],
    });

    const tarjeta = fixture.nativeElement.querySelector('[data-testid="liquidacion-L-5"]') as HTMLElement;
    expect(tarjeta.textContent).toContain('Servicio');
    expect(tarjeta.textContent).toContain('—');
    expect(tarjeta.textContent).not.toContain('undefined');
    expect(tarjeta.textContent).not.toContain('Invalid Date');
  });

  it('el motivo de rechazo vive dentro de su tarjeta', () => {
    const { fixture } = setup({
      lista: [liquidacion({ id: 'L-9', estado: 'RECHAZADA', motivoRechazo: 'No coincide.' })],
    });

    const motivo = fixture.nativeElement.querySelector('[data-testid="motivo-L-9"]') as HTMLElement;
    expect(motivo.closest('article')).toBe(
      fixture.nativeElement.querySelector('[data-testid="liquidacion-L-9"]'),
    );
  });

  it('cada documento es su propia tarjeta', () => {
    const { fixture } = setup({
      documentos: [
        { id: 'd1', tipo: 'MATRICULA_CONTE', nombre: 'Matrícula CONTE', estadoValidacion: 'APROBADO' },
      ],
    });

    const tarjeta = fixture.nativeElement.querySelector('[data-testid="documento-d1"]') as HTMLElement;
    expect(tarjeta.classList.contains('cd-card')).toBe(true);
  });

  describe('jerarquía de Gestión', () => {
    function iso(diasDesdeHoy: number): string {
      const f = new Date();
      f.setDate(f.getDate() + diasDesdeHoy);
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    }

    const q = (fixture: ComponentFixture<LiquidacionesTecnicoPage>, id: string) =>
      fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    it('los documentos van antes que las liquidaciones', () => {
      const { fixture } = setup({ lista: [liquidacion()] });
      const docs = q(fixture, 'seccion-documentos')!;
      const liqs = q(fixture, 'seccion-liquidaciones')!;

      expect(docs).not.toBeNull();
      expect(liqs).not.toBeNull();
      expect(docs.compareDocumentPosition(liqs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('las liquidaciones arrancan plegadas y se abren con el encabezado', () => {
      const { fixture } = setup({ lista: [liquidacion()] });
      const toggle = q(fixture, 'liquidaciones-toggle') as HTMLButtonElement;
      const contenido = q(fixture, 'liquidaciones-contenido')!;

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(contenido.hasAttribute('hidden')).toBe(true);

      toggle.click();
      fixture.detectChanges();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(q(fixture, 'liquidaciones-contenido')!.hasAttribute('hidden')).toBe(false);
    });

    it('el encabezado plegado resume la comisión por consignar y las liquidaciones en verificación', () => {
      const { fixture } = setup({
        lista: [
          liquidacion({ id: 'L-1', comision: 15_000 }),
          liquidacion({ id: 'L-2', estado: 'EN_VERIFICACION' }),
        ],
      });

      const resumen = q(fixture, 'liquidaciones-resumen')!.textContent ?? '';
      expect(resumen).toContain('15.000');
      expect(resumen).toContain('1 en verificación');
    });

    it('la deuda por consignar se avisa fuera del plegable: bloquea tomar servicios y no se esconde', () => {
      const { fixture } = setup({ lista: [liquidacion({ comision: 15_000 })] });
      const aviso = q(fixture, 'aviso-consignacion');

      expect(aviso).not.toBeNull();
      expect(aviso!.textContent).toContain('15.000');
      expect(q(fixture, 'liquidaciones-contenido')!.contains(aviso)).toBe(false);
    });

    it('sin deuda no hay aviso de consignación', () => {
      const { fixture } = setup({ lista: [liquidacion({ estado: 'APROBADA' })] });

      expect(q(fixture, 'aviso-consignacion')).toBeNull();
    });

    it('avisa arriba cuando hay documentos vencidos o por vencer', () => {
      const { fixture } = setup({
        documentos: [
          { id: 'a', tipo: 'CEDULA', nombre: 'Cédula', estadoValidacion: 'APROBADO', fechaVencimiento: iso(-5) },
          { id: 'b', tipo: 'RUT', nombre: 'RUT', estadoValidacion: 'APROBADO', fechaVencimiento: iso(12) },
          { id: 'c', tipo: 'OTRO', nombre: 'Otro', estadoValidacion: 'APROBADO', fechaVencimiento: iso(400) },
        ],
      });

      const aviso = q(fixture, 'aviso-documentos')!;
      expect(aviso).not.toBeNull();
      expect(aviso.textContent).toContain('1 vencido');
      expect(aviso.textContent).toContain('1 por vencer');
    });

    it('con los documentos al día no hay aviso', () => {
      const { fixture } = setup({
        documentos: [
          { id: 'a', tipo: 'CEDULA', nombre: 'Cédula', estadoValidacion: 'APROBADO', fechaVencimiento: iso(400) },
        ],
      });

      expect(q(fixture, 'aviso-documentos')).toBeNull();
    });
  });

  describe('declarar documentos desde la app', () => {
    const q = (fixture: ComponentFixture<LiquidacionesTecnicoPage>, id: string) =>
      fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    it('el formulario está oculto hasta tocar Declarar documento', () => {
      const { fixture } = setup();

      expect(q(fixture, 'documento-form')).toBeNull();
      (q(fixture, 'declarar-documento') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(q(fixture, 'documento-form')).not.toBeNull();
    });

    it('declara el documento del técnico autenticado y recarga la lista', () => {
      const { fixture, tecnicosApi, toast } = setup();
      fixture.componentInstance.declararDocumento({
        tipo: 'CEDULA',
        fechaExpedicion: '2026-01-10',
        fechaVencimiento: '2030-01-10',
      });

      expect(tecnicosApi.subirDocumento).toHaveBeenCalledWith('T-1', 'CEDULA', '', '2026-01-10', '2030-01-10');
      expect(tecnicosApi.getMisDocumentos).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalled();
    });

    it('si falla, avisa con el error y deja el formulario abierto', () => {
      const { fixture, tecnicosApi, toast } = setup();
      tecnicosApi.subirDocumento.mockReturnValueOnce(throwError(() => new Error('sin red')));
      fixture.componentInstance.mostrarFormulario.set(true);

      fixture.componentInstance.declararDocumento({ tipo: 'RUT', fechaExpedicion: '2026-01-10' });

      expect(toast.error).toHaveBeenCalled();
      expect(fixture.componentInstance.mostrarFormulario()).toBe(true);
    });

    it('sin fecha de expedición no llama al backend', () => {
      const { fixture, tecnicosApi } = setup();

      fixture.componentInstance.declararDocumento({ tipo: 'RUT' });

      expect(tecnicosApi.subirDocumento).not.toHaveBeenCalled();
    });
  });
});
