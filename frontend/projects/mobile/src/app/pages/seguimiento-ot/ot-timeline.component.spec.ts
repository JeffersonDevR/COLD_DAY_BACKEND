import { formatDate } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { EstadoOt, HistorialOtItem } from '@core/models/common.models';
import { OtTimelineComponent } from './ot-timeline.component';

function montar(estadoActual: EstadoOt, historial: HistorialOtItem[]) {
  TestBed.configureTestingModule({
    imports: [OtTimelineComponent],
    providers: [provideIonicAngular()],
  });
  const fixture = TestBed.createComponent(OtTimelineComponent);
  fixture.componentRef.setInput('estadoActual', estadoActual);
  fixture.componentRef.setInput('historial', historial);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const paso = (raiz: HTMLElement, estado: EstadoOt) =>
  raiz.querySelector(`[data-testid="timeline-paso-${estado}"]`)!;

const horaDe = (raiz: HTMLElement, estado: EstadoOt) =>
  paso(raiz, estado).querySelector('.cd-timeline__hora')?.textContent?.trim() ?? null;

const entrada = (estado: EstadoOt, fecha: string): HistorialOtItem => ({ estado, fecha });

const corta = (fecha: string) => formatDate(fecha, 'short', TestBed.inject(LOCALE_ID));

describe('OtTimelineComponent (progreso vertical)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('pone la hora en los pasos alcanzados', () => {
    const raiz = montar('EN_CAMINO', [
      entrada('SOLICITADA', '2026-11-03T10:00:00Z'),
      entrada('EN_CAMINO', '2026-11-03T11:30:00Z'),
    ]);

    expect(horaDe(raiz, 'SOLICITADA')).toBe(corta('2026-11-03T10:00:00Z'));
    expect(horaDe(raiz, 'EN_CAMINO')).toBe(corta('2026-11-03T11:30:00Z'));
    expect(horaDe(raiz, 'ASIGNADA')).toBeNull();
  });

  const vieja = '2026-11-03T10:00:00Z';
  const nueva = '2026-11-05T10:00:00Z';

  it.each([
    ['en orden', [vieja, nueva]],
    ['al revés', [nueva, vieja]],
  ])('con un estado repetido usa la más reciente (%s)', (_caso, fechas) => {
    const raiz = montar(
      'ASIGNADA',
      fechas.map((fecha) => entrada('ASIGNADA', fecha)),
    );

    expect(horaDe(raiz, 'ASIGNADA')).toBe(corta(nueva));
  });

  it('un paso no alcanzado no muestra hora', () => {
    const raiz = montar('BUSCANDO_TECNICO', [entrada('ASIGNADA', vieja)]);

    expect(horaDe(raiz, 'ASIGNADA')).toBeNull();
  });

  it('el historial sigue plegado', () => {
    const raiz = montar('ASIGNADA', [entrada('ASIGNADA', vieja)]);

    const historial = raiz.querySelector('[data-testid="timeline-historial"]')!;
    expect(historial).not.toBeNull();
    expect(historial.hasAttribute('open')).toBe(false);
  });
});
