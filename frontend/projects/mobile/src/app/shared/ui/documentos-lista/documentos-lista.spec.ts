import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { DocumentoVista, DocumentosListaComponent } from './documentos-lista';

function iso(diasDesdeHoy: number): string {
  const f = new Date();
  f.setDate(f.getDate() + diasDesdeHoy);
  const mes = String(f.getMonth() + 1).padStart(2, '0');
  const dia = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${mes}-${dia}`;
}

function montar(documentos: DocumentoVista[]): ComponentFixture<DocumentosListaComponent> {
  TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
  const fixture = TestBed.createComponent(DocumentosListaComponent);
  fixture.componentRef.setInput('documentos', documentos);
  fixture.detectChanges();
  return fixture;
}

const texto = (f: ComponentFixture<unknown>, testId: string): string =>
  (f.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)?.textContent ?? '';

describe('DocumentosListaComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('cada documento es su propia tarjeta con su título', () => {
    const f = montar([
      { id: 'a', titulo: 'RUT' },
      { id: 'b', titulo: 'Cámara de Comercio' },
    ]);

    expect(f.nativeElement.querySelectorAll('article')).toHaveLength(2);
    expect(texto(f, 'documento-a')).toContain('RUT');
    expect(texto(f, 'documento-b')).toContain('Cámara de Comercio');
  });

  it('marca Vencido en un documento vencido y Por vencer en uno que vence pronto', () => {
    const f = montar([
      { id: 'v', titulo: 'Cédula', vencimiento: iso(-3) },
      { id: 'p', titulo: 'Matrícula', vencimiento: iso(10) },
      { id: 'o', titulo: 'RUT', vencimiento: iso(200) },
    ]);

    expect(texto(f, 'vigencia-v')).toContain('Vencido');
    expect(texto(f, 'vigencia-p')).toContain('Por vencer');
    expect(texto(f, 'vigencia-o')).toContain('Vigente');
  });

  it('un documento sin vencimiento no muestra chip de vigencia ni "Vence"', () => {
    const f = montar([{ id: 'x', titulo: 'RUT' }]);

    expect(f.nativeElement.querySelector('[data-testid="vigencia-x"]')).toBeNull();
    expect(texto(f, 'documento-x')).not.toContain('Vence');
  });

  it('muestra el estado de validación y las observaciones cuando las hay', () => {
    const f = montar([
      {
        id: 'r',
        titulo: 'Antecedentes',
        estadoTexto: 'Rechazado',
        estadoTono: 'cerrada',
        observaciones: 'Ilegible, vuelve a declararlo.',
      },
    ]);

    expect(texto(f, 'estado-r')).toContain('Rechazado');
    expect(texto(f, 'documento-r')).toContain('Ilegible, vuelve a declararlo.');
  });

  it('muestra la fecha de expedición y la de vencimiento en formato legible', () => {
    const f = montar([{ id: 'f', titulo: 'Cédula', expedicion: '2026-01-15', vencimiento: '2030-05-20' }]);
    const t = texto(f, 'documento-f');

    expect(t).toContain('Expide');
    expect(t).toContain('Vence');
    expect(t).not.toContain('2030-05-20');
  });
});
