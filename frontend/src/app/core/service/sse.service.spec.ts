import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SseService, OtEstadoCambiado } from './sse.service';
import { ApiConfig } from './api.config';

type Listener = (evento: MessageEvent) => void;

/** Avanza lo suficiente para disparar cualquier reintento programado. */
const RETARDO_PARA_TEST = 30000;

/**
 * Doble de `EventSource`: jsdom no lo implementa. Registra listeners y permite
 * simular el protocolo SSE (eventos nombrados, `data:` y comentarios `:ping`).
 */
class FakeEventSource {
  static readonly instancias: FakeEventSource[] = [];

  readonly listeners = new Map<string, Listener[]>();
  cerrado = false;
  onopen: ((evento: Event) => void) | null = null;
  onerror: ((evento: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeEventSource.instancias.push(this);
  }

  static get ultima(): FakeEventSource {
    return FakeEventSource.instancias[FakeEventSource.instancias.length - 1];
  }

  static reset(): void {
    FakeEventSource.instancias.length = 0;
  }

  addEventListener(tipo: string, listener: Listener): void {
    const previos = this.listeners.get(tipo) ?? [];
    this.listeners.set(tipo, [...previos, listener]);
  }

  close(): void {
    this.cerrado = true;
  }

  /** Simula un chunk SSE crudo, igual que lo parsearía el navegador. */
  simularChunk(texto: string): void {
    for (const bloque of texto.split('\n\n')) {
      if (!bloque.trim()) continue;
      let nombre = 'message';
      const datos: string[] = [];
      for (const linea of bloque.split('\n')) {
        // Un comentario (heartbeat `:ping`) no produce evento.
        if (linea.startsWith(':')) continue;
        if (linea.startsWith('event:')) nombre = linea.slice('event:'.length).trim();
        else if (linea.startsWith('data:')) datos.push(linea.slice('data:'.length).replace(/^ /, ''));
      }
      if (datos.length === 0) continue;
      this.emitir(nombre, datos.join('\n'));
    }
  }

  emitir(tipo: string, data: string): void {
    for (const listener of this.listeners.get(tipo) ?? []) {
      listener({ data } as MessageEvent);
    }
  }

  abrir(): void {
    this.onopen?.(new Event('open'));
  }

  fallar(): void {
    this.onerror?.(new Event('error'));
  }
}

function instalarEventSource(): void {
  Object.defineProperty(globalThis, 'EventSource', {
    value: FakeEventSource,
    configurable: true,
    writable: true,
  });
}

function quitarEventSource(): void {
  Reflect.deleteProperty(globalThis, 'EventSource');
}

describe('SseService', () => {
  let api: SseService;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    FakeEventSource.reset();
    instalarEventSource();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SseService);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    quitarEventSource();
  });

  it('pide el ticket y abre el EventSource con el ticket en la query', () => {
    api.abrirOtStream('ot1').subscribe();

    const ticket = http.expectOne('/api/sse/ticket');
    expect(ticket.request.method).toBe('POST');
    ticket.flush({ codigo: 't1', expiraEnSegundos: 30 });

    expect(FakeEventSource.instancias.length).toBe(1);
    expect(FakeEventSource.ultima.url).toBe('/api/ot/ot1/stream?ticket=t1');
  });

  it('parsea y emite un evento ot-estado-cambiado', () => {
    const recibidos: OtEstadoCambiado[] = [];
    api.abrirOtStream('ot1').subscribe((payload) => recibidos.push(payload));
    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });

    FakeEventSource.ultima.simularChunk(
      'event: ot-estado-cambiado\ndata: {"otId":"ot1","origen":"EN_CAMINO","destino":"EN_DIAGNOSTICO"}\n\n',
    );

    expect(recibidos).toEqual([{ otId: 'ot1', origen: 'EN_CAMINO', destino: 'EN_DIAGNOSTICO' }]);
  });

  it('un comentario :ping no produce emisión', () => {
    const recibidos: OtEstadoCambiado[] = [];
    api.abrirOtStream('ot1').subscribe((payload) => recibidos.push(payload));
    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });

    FakeEventSource.ultima.simularChunk(':ping\n\n');

    expect(recibidos).toEqual([]);
  });

  it('descarta un payload malformado sin cerrar el stream', () => {
    const recibidos: OtEstadoCambiado[] = [];
    const sub = api.abrirOtStream('ot1').subscribe((payload) => recibidos.push(payload));
    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });
    const fuente = FakeEventSource.ultima;

    fuente.simularChunk('event: ot-estado-cambiado\ndata: {no-json\n\n');

    expect(recibidos).toEqual([]);
    expect(sub.closed).toBe(false);
    expect(fuente.cerrado).toBe(false);
  });

  it('ante un error cierra la fuente y pide un ticket NUEVO antes de reabrir', () => {
    vi.useFakeTimers();
    api.abrirOtStream('ot1').subscribe();
    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });
    const primera = FakeEventSource.ultima;

    primera.fallar();

    // Cerró la fuente quemada...
    expect(primera.cerrado).toBe(true);
    // ...y aún no hay reintento: respeta el backoff.
    http.expectNone('/api/sse/ticket');

    vi.advanceTimersByTime(1000);

    const segundoTicket = http.expectOne('/api/sse/ticket');
    segundoTicket.flush({ codigo: 't2', expiraEnSegundos: 30 });

    expect(FakeEventSource.instancias.length).toBe(2);
    expect(FakeEventSource.ultima).not.toBe(primera);
    expect(FakeEventSource.ultima.url).toBe('/api/ot/ot1/stream?ticket=t2');
  });

  it('al desuscribirse cierra la fuente y cancela el reintento pendiente', () => {
    vi.useFakeTimers();
    const sub = api.abrirOtStream('ot1').subscribe();
    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });
    const fuente = FakeEventSource.ultima;

    fuente.fallar(); // programa un reintento con backoff
    sub.unsubscribe();

    expect(fuente.cerrado).toBe(true);

    vi.advanceTimersByTime(60000);
    // Tras el teardown no debe pedirse otro ticket ni abrir otra fuente.
    http.expectNone('/api/sse/ticket');
    expect(FakeEventSource.instancias.length).toBe(1);
  });

  it('un fallo al pedir el ticket también reintenta con backoff', () => {
    vi.useFakeTimers();
    api.abrirOtStream('ot1').subscribe({ error: () => undefined });
    http
      .expectOne('/api/sse/ticket')
      .flush('no autorizado', { status: 401, statusText: 'Unauthorized' });

    http.expectNone('/api/sse/ticket');
    vi.advanceTimersByTime(1000);

    http.expectOne('/api/sse/ticket').flush({ codigo: 't1', expiraEnSegundos: 30 });
    expect(FakeEventSource.instancias.length).toBe(1);
  });

  it('se rinde tras varios fallos consecutivos y emite error', () => {
    vi.useFakeTimers();
    let error: Error | undefined;
    api.abrirOtStream('ot1').subscribe({ error: (err: Error) => (error = err) });

    // 5 fallos consecutivos: 4 reintentos con backoff y el 5.º se rinde.
    for (let intento = 0; intento < 5; intento++) {
      http.expectOne('/api/sse/ticket').flush({ codigo: `t${intento}`, expiraEnSegundos: 30 });
      FakeEventSource.ultima.fallar();
      if (intento < 4) vi.advanceTimersByTime(RETARDO_PARA_TEST);
    }

    expect(error?.message).toContain('stream');
    http.expectNone('/api/sse/ticket');
  });

  it('en modo mock no abre EventSource ni pide ticket', () => {
    config.setUseMocks(true);
    let completo = false;
    api.abrirOtStream('ot1').subscribe({ complete: () => (completo = true) });

    expect(completo).toBe(true);
    http.expectNone('/api/sse/ticket');
    expect(FakeEventSource.instancias.length).toBe(0);
  });

  it('sin EventSource (SSR) no lanza y completa', () => {
    quitarEventSource();
    let completo = false;
    api.abrirOtStream('ot1').subscribe({ complete: () => (completo = true) });

    expect(completo).toBe(true);
    http.expectNone('/api/sse/ticket');
  });
});
