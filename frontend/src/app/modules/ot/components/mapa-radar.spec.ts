import { TestBed } from '@angular/core/testing';
import { MapaRadar, RadarTecnicoItem } from './mapa-radar';
import { GoogleMapsLoaderService } from '../../../core/shared/infrastructure/maps/google-maps-loader';

function setup() {
  const mapsLoader = { isLoaded: () => false, isLoading: () => false, loadError: () => null, init: vi.fn() };
  TestBed.configureTestingModule({
    providers: [{ provide: GoogleMapsLoaderService, useValue: mapsLoader }],
  });
  // No se llama detectChanges para evitar montar los componentes de Google Maps.
  const fixture = TestBed.createComponent(MapaRadar);
  return { fixture, component: fixture.componentInstance, mapsLoader };
}

describe('MapaRadar', () => {
  it('expone la lista demo de técnicos y filtra por radio', () => {
    const { component } = setup();
    expect(component.tecnicos().length).toBe(4);
    expect(component.tecnicosEnRango().length).toBe(2);
  });

  it('usa técnicos externos cuando se proveen', () => {
    const { fixture, component } = setup();
    const externos: RadarTecnicoItem[] = [
      { id: 'x', nombre: 'X', especialidad: 'Y', distanciaKm: 30, lat: 7.9, lng: -72.5, disponible: true },
    ];
    fixture.componentRef.setInput('tecnicosExternos', externos);
    expect(component.tecnicos().length).toBe(1);
    expect(component.tecnicosEnRango().length).toBe(0);
  });

  it('expande el radio de 5 en 5 km y emite el cambio', () => {
    const { component } = setup();
    const emitidos: number[] = [];
    component.radioCambiado.subscribe((v) => emitidos.push(v));

    component.simularExpansionRadio();
    expect(component.radioActualKm()).toBe(15);

    component.simularExpansionRadio();
    component.simularExpansionRadio();
    expect(component.radioActualKm()).toBe(25);

    component.simularExpansionRadio();
    expect(component.radioActualKm()).toBe(25);
    expect(emitidos).toEqual([15, 20, 25]);
  });

  it('reinicia el radar a 10 km', () => {
    const { component } = setup();
    component.radioActualKm.set(25);
    const emitidos: number[] = [];
    component.radioCambiado.subscribe((v) => emitidos.push(v));

    component.reiniciarRadar();

    expect(component.radioActualKm()).toBe(10);
    expect(component.segundosRestantes()).toBe(60);
    expect(emitidos).toEqual([10]);
  });

  it('calcula radio en metros y nivel de zoom', () => {
    const { component } = setup();
    expect(component.radioMetros()).toBe(10000);
    expect(component.zoomNivel()).toBe(13);

    component.radioActualKm.set(25);
    expect(component.radioMetros()).toBe(25000);
    expect(component.zoomNivel()).toBe(11.5);
  });

  it('proyecta coordenadas al SVG', () => {
    const { component } = setup();
    const tec: RadarTecnicoItem = { id: '1', nombre: 'A', especialidad: 'x', distanciaKm: 1, lat: 7.886, lng: -72.498, disponible: true };
    expect(component.getSvgX(tec)).toBeCloseTo(200 + (-72.498 + 72.5078) * 800, 2);
    expect(component.getSvgY(tec)).toBeCloseTo(200 + (7.8939 - 7.886) * 800, 2);
  });

  it('ajusta el tamaño del marcador según el rango', () => {
    const { component } = setup();
    const cerca: RadarTecnicoItem = { id: '1', nombre: 'A', especialidad: 'x', distanciaKm: 5, lat: 7.9, lng: -72.5, disponible: true };
    const lejos: RadarTecnicoItem = { ...cerca, distanciaKm: 20 };
    expect(component.getTecnicoMarkerOptions(cerca).icon.scale).toBe(6.5);
    expect(component.getTecnicoMarkerOptions(lejos).icon.scale).toBe(5);
  });

  it('calcula el radio SVG activo con tope de 175', () => {
    const { component } = setup();
    expect(component.activeRadiusSvg()).toBe(70);
    component.radioActualKm.set(25);
    expect(component.activeRadiusSvg()).toBe(175);
  });
});
