import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { snowOutline } from 'ionicons/icons';
import { MarcaBarraComponent } from './marca-barra';

// Sin registro, ion-icon intenta bajar el SVG y ensucia la salida del runner.
addIcons({ snowOutline });

function setup(props: { pantalla?: string; chip?: string; chipTestId?: string } = {}) {
  TestBed.configureTestingModule({
    imports: [MarcaBarraComponent],
    providers: [provideIonicAngular()],
  });

  const fixture: ComponentFixture<MarcaBarraComponent> =
    TestBed.createComponent(MarcaBarraComponent);
  if (props.pantalla) fixture.componentRef.setInput('pantalla', props.pantalla);
  if (props.chip !== undefined) fixture.componentRef.setInput('chip', props.chip);
  if (props.chipTestId) fixture.componentRef.setInput('chipTestId', props.chipTestId);
  fixture.detectChanges();
  return { fixture };
}

describe('MarcaBarraComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra la marca, la etiqueta de pantalla y el chip de contexto', () => {
    const { fixture } = setup({ pantalla: 'Radar', chip: 'Técnico' });
    const texto = fixture.nativeElement.textContent ?? '';

    expect(texto).toContain('Cold Day · Ops');
    expect(texto).toContain('Radar');
    expect(texto).toContain('Técnico');
  });

  it('dibuja el copo del logotipo propio en vez del icono genérico', () => {
    const { fixture } = setup({ pantalla: 'Radar' });

    expect(fixture.nativeElement.querySelector('.cd-marca__logo .cd-marca__copo')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ion-icon[name="snow-outline"]')).toBeNull();
  });

  it('oculta el chip cuando no hay contexto', () => {
    const { fixture } = setup({ pantalla: 'Mi cuenta', chip: '' });

    expect(fixture.nativeElement.querySelector('.cd-chip--activo')).toBeNull();
  });

  it('expone el testid del chip para las specs de las pantallas', () => {
    const { fixture } = setup({ pantalla: 'Mi cuenta', chip: 'Verificado', chipTestId: 'cuenta-verificado' });

    expect(
      fixture.nativeElement.querySelector('[data-testid="cuenta-verificado"]')?.textContent,
    ).toContain('Verificado');
  });
});
