import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { DeclaracionDocumento, DocumentoFormComponent } from './documento-form';

const TIPOS = [
  { valor: 'RUT', etiqueta: 'RUT' },
  { valor: 'CEDULA', etiqueta: 'Cédula' },
];

function montar(
  inputs: { pideExpedicion?: boolean; vencimientoObligatorio?: boolean; guardando?: boolean } = {},
) {
  TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
  const fixture: ComponentFixture<DocumentoFormComponent> = TestBed.createComponent(DocumentoFormComponent);
  fixture.componentRef.setInput('tipos', TIPOS);
  for (const [clave, valor] of Object.entries(inputs)) fixture.componentRef.setInput(clave, valor);
  fixture.detectChanges();
  const emitidos: DeclaracionDocumento[] = [];
  fixture.componentInstance.declarar.subscribe((d) => emitidos.push(d));
  return { fixture, comp: fixture.componentInstance, emitidos };
}

describe('DocumentoFormComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('arranca con el primer tipo elegido', () => {
    const { comp } = montar();
    expect(comp.formulario.controls.tipo.value).toBe('RUT');
  });

  it('con vencimiento opcional declara sin fechas', () => {
    const { comp, emitidos } = montar();

    comp.enviar();

    expect(emitidos).toEqual([{ tipo: 'RUT', fechaExpedicion: undefined, fechaVencimiento: undefined }]);
  });

  it('si pide expedición, no emite sin ella y marca el campo', () => {
    const { comp, emitidos } = montar({ pideExpedicion: true });

    comp.enviar();

    expect(emitidos).toHaveLength(0);
    expect(comp.formulario.controls.fechaExpedicion.touched).toBe(true);
  });

  it('con expedición completa emite las dos fechas', () => {
    const { comp, emitidos } = montar({ pideExpedicion: true });
    comp.formulario.patchValue({ tipo: 'CEDULA', fechaExpedicion: '2026-01-10', fechaVencimiento: '2030-01-10' });

    comp.enviar();

    expect(emitidos).toEqual([{ tipo: 'CEDULA', fechaExpedicion: '2026-01-10', fechaVencimiento: '2030-01-10' }]);
  });

  it('si el vencimiento es obligatorio no emite sin él', () => {
    const { comp, emitidos } = montar({ vencimientoObligatorio: true });

    comp.enviar();
    expect(emitidos).toHaveLength(0);

    comp.formulario.patchValue({ fechaVencimiento: '2027-03-01' });
    comp.enviar();
    expect(emitidos).toHaveLength(1);
  });

  it('mientras se guarda no emite dos veces', () => {
    const { comp, emitidos } = montar({ guardando: true });

    comp.enviar();

    expect(emitidos).toHaveLength(0);
  });
});
