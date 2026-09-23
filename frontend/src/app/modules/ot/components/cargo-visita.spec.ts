import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CargoVisitaDiagnostico } from './cargo-visita';
import { OtApi } from '../infrastructure/ot-api';

describe('CargoVisitaDiagnostico', () => {
  async function create(nota?: string) {
    const estimacion = {
      distanciaKm: 0,
      tarifaFuente: 'LINEAL' as const,
      banda: 0,
      tarifa: 30000,
      fueraDeRango: false,
    };
    await TestBed.configureTestingModule({
      imports: [CargoVisitaDiagnostico],
      providers: [{ provide: OtApi, useValue: { estimarTarifa: () => of(estimacion) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(CargoVisitaDiagnostico);
    if (nota !== undefined) {
      fixture.componentRef.setInput('nota', nota);
    }
    fixture.componentRef.setInput('punto', { latitud: 7.89, longitud: -72.5 });
    fixture.detectChanges();
    return fixture;
  }

  it('consulta y muestra la tarifa estimada del backend', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.estimacion()?.tarifa).toBe(30000);
  });

  it('formatea los valores en pesos', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.formato(40000)).toContain('$');
    expect(fixture.componentInstance.formato(40000)).toContain('40.000');
  });

  it('renderiza el aviso y la nota personalizada', async () => {
    const fixture = await create('Nota especial de prueba');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Visita y diagnóstico');
    expect(text).toContain('Nota especial de prueba');
  });
});
