import { Component } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../app.config';
import { APP_LOCALE_ID, provideColombianLocale } from './locale';

/**
 * Fixed local timestamp: the pipe formats in local time, so the date and time
 * fields are the same in every timezone (no environment-dependent output).
 */
const FECHA_FIJA = new Date(2026, 9, 28, 14, 5, 9);

@Component({
  selector: 'app-locale-host',
  imports: [DatePipe, DecimalPipe],
  template: `
    <span data-testid="short-date">{{ fecha | date: 'shortDate' }}</span>
    <span data-testid="short-time">{{ fecha | date: 'shortTime' }}</span>
    <span data-testid="distancia">{{ distancia | number: '1.1-1' }}</span>
  `,
})
class LocaleHostComponent {
  readonly fecha = FECHA_FIJA;
  readonly distancia = 3.5;
}

function render(): HTMLElement {
  TestBed.configureTestingModule({ providers: [...provideColombianLocale()] });
  const fixture = TestBed.createComponent(LocaleHostComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function texto(host: HTMLElement, id: string): string {
  return host.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? '';
}

describe('locale es-CO para los pipes de Angular', () => {
  it('el appConfig registra LOCALE_ID es-CO', () => {
    expect(appConfig.providers).toContainEqual({ provide: LOCALE_ID, useValue: APP_LOCALE_ID });
    expect(APP_LOCALE_ID).toBe('es-CO');
  });

  it('el TestBed arranca con la locale colombiana', () => {
    TestBed.configureTestingModule({ providers: [...provideColombianLocale()] });
    expect(TestBed.inject(LOCALE_ID)).toBe('es-CO');
  });

  it('date:shortDate usa día/mes/año colombiano', () => {
    // es-CO CLDR: d/MM/yy — a two-digit year is the locale's own shortDate.
    expect(texto(render(), 'short-date')).toBe('28/10/26');
  });

  it('date:shortTime usa el reloj de 12 horas con a. m./p. m.', () => {
    // Narrow no-break space (U+202F) between the time and the meridiem.
    expect(texto(render(), 'short-time')).toBe('2:05\u202fp.\u202fm.');
  });

  it('number usa la coma como separador decimal', () => {
    expect(texto(render(), 'distancia')).toBe('3,5');
  });
});
