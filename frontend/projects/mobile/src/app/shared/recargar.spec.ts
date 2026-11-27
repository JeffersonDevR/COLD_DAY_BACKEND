import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { MobileToastService } from '../core/toast.service';
import { ContenidoRecargaComponent, RecargarDirective } from './recargar';

// Un `ion-refresher` real necesita un `ion-content` medido; la directiva solo
// depende del evento y de `target.complete()`.
@Component({
  imports: [RecargarDirective],
  template: `<div [cdRecargar]="recargar"></div>`,
})
class Anfitrion {
  recargar: () => Observable<unknown> = () => of(1);
}

function setup(recargar: () => Observable<unknown>) {
  const toast = { error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [{ provide: MobileToastService, useValue: toast }],
  });
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.componentInstance.recargar = recargar;
  fixture.detectChanges();
  const complete = vi.fn();
  const deslizar = () => {
    const evento = new CustomEvent('ionRefresh');
    Object.defineProperty(evento, 'target', { value: { complete } });
    (fixture.nativeElement.querySelector('div') as HTMLElement).dispatchEvent(evento);
  };
  return { deslizar, complete, toast };
}

describe('cdRecargar', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('recarga y cierra el indicador', () => {
    const recargar = vi.fn(() => of(1));
    const { deslizar, complete, toast } = setup(recargar);

    deslizar();

    expect(recargar).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('si falla, cierra el indicador y avisa', () => {
    const { deslizar, complete, toast } = setup(() =>
      throwError(() => new ApiHttpError('boom', 500)),
    );

    deslizar();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('No pudimos actualizar', expect.any(String));
  });

  it('el contenido usa los textos del sistema', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(ContenidoRecargaComponent);
    fixture.detectChanges();
    const contenido = fixture.nativeElement.querySelector('ion-refresher-content') as HTMLElement & {
      pullingText?: string;
      refreshingText?: string;
    };

    expect(contenido.pullingText).toBe('Desliza para actualizar');
    expect(contenido.refreshingText).toBe('Actualizando...');
  });
});
