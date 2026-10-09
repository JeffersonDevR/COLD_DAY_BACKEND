import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { ApiConfig } from './api.config';
import { EstadoOt } from '../models/common.models';

/** Payload que el backend empuja en el evento `ot-estado-cambiado`. */
export interface OtEstadoCambiado {
  otId: string;
  origen: EstadoOt;
  destino: EstadoOt;
}

/** Respuesta de `POST /api/sse/ticket`. */
interface SseTicketResponse {
  codigo: string;
  expiraEnSegundos: number;
}

/** Nombre del evento con el que el backend anuncia un cambio de estado. */
const EVENTO_ESTADO = 'ot-estado-cambiado';

/** Backoff: arranca en 1 s y se duplica hasta el tope de 30 s. */
const RETARDO_BASE_MS = 1000;
const RETARDO_MAX_MS = 30000;

/**
 * Tope de fallos consecutivos antes de rendirse. Un ticket vencido, quemado o
 * de una OT ajena responde 401/403/404 y `EventSource` no alcanza a abrir: sin
 * este tope, el reintento se volvería un bucle infinito.
 */
const MAX_FALLOS_CONSECUTIVOS = 5;

/**
 * Vida mínima para considerar que una conexión estuvo sana. Resetear el
 * contador apenas abre (`onopen`) lo anula: un servidor que acepta y cierra al
 * instante deja el contador en cero en cada vuelta y el tope nunca se alcanza.
 * Resetear solo al recibir un evento tampoco sirve: una OT sin cambios puede
 * estar horas sana y muda, y unas pocas caídas aisladas la rendirían. Por eso
 * el criterio es cuánto VIVIÓ la conexión, no si llegó a abrir.
 */
const VIDA_MINIMA_MS = 10000;

/**
 * Consume el stream SSE de cambios de estado de una OT.
 *
 * TRAMPA (queda documentada porque parece un bug): `EventSource` reconecta solo
 * reusando la MISMA URL, pero el ticket es de un solo uso y se quema al abrir,
 * así que la reconexión nativa recibe 401 y reintenta en loop. Por eso acá NO se
 * usa la reconexión nativa: en `onerror` se cierra la fuente, se espera con
 * backoff exponencial, se pide un ticket NUEVO y se reabre. Nunca se reusa un
 * ticket.
 *
 * El observable es frío: cada suscripción abre su propia conexión y la cierra
 * al desuscribirse (cancelando también cualquier reintento pendiente). Esa
 * desuscripción es la única forma de detener el stream; no deja timers ni
 * conexiones colgadas.
 *
 * En modo mock, o cuando no existe `EventSource` (SSR), devuelve un observable
 * vacío que completa sin abrir nada.
 */
@Injectable({
  providedIn: 'root',
})
export class SseService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfig);

  /** Stream frío de cambios de estado; cerrar la suscripción corta el stream. */
  abrirOtStream(otId: string): Observable<OtEstadoCambiado> {
    // Sin backend (mock) o sin EventSource (SSR): no hay nada que abrir.
    if (this.apiConfig.useMocks()) return EMPTY;
    if (typeof EventSource === 'undefined') return EMPTY;

    return new Observable<OtEstadoCambiado>((subscriber) => {
      let fuente: EventSource | null = null;
      let temporizador: ReturnType<typeof setTimeout> | null = null;
      let detenido = false;
      let fallosConsecutivos = 0;
      let conexionAbiertaEn = 0;

      const limpiar = (): void => {
        if (temporizador !== null) {
          clearTimeout(temporizador);
          temporizador = null;
        }
        fuente?.close();
        fuente = null;
      };

      const programarReintento = (): void => {
        const espera = Math.min(RETARDO_BASE_MS * 2 ** (fallosConsecutivos - 1), RETARDO_MAX_MS);
        temporizador = setTimeout(() => {
          temporizador = null;
          abrir();
        }, espera);
      };

      const registrarFallo = (): void => {
        if (detenido) return;
        // Una conexión que vivió lo suficiente no es parte de un bucle de
        // fallos: el contador vuelve a cero para no rendirse por caídas
        // aisladas repartidas en el tiempo.
        if (conexionAbiertaEn > 0 && Date.now() - conexionAbiertaEn >= VIDA_MINIMA_MS) {
          fallosConsecutivos = 0;
        }
        conexionAbiertaEn = 0;
        fallosConsecutivos++;
        if (fallosConsecutivos >= MAX_FALLOS_CONSECUTIVOS) {
          detenido = true;
          limpiar();
          subscriber.error(new Error('No se pudo establecer el stream de la orden.'));
          return;
        }
        programarReintento();
      };

      const abrir = (): void => {
        if (detenido) return;
        this.pedirTicket().subscribe({
          next: (ticket) => {
            if (detenido) return;
            const url = `${this.apiConfig.url(`/ot/${otId}/stream`)}?ticket=${encodeURIComponent(ticket.codigo)}`;
            const evento = new EventSource(url);
            fuente = evento;
            evento.onopen = () => {
              // Solo se registra el instante de apertura: el contador NO se
              // resetea acá, porque eso permitiría un bucle infinito contra un
              // servidor que acepta y cierra de inmediato.
              conexionAbiertaEn = Date.now();
            };
            evento.addEventListener(EVENTO_ESTADO, (mensaje: MessageEvent) => {
              const payload = this.parsearPayload(mensaje.data);
              // Un payload inválido se descarta; el stream sigue vivo.
              if (!payload) return;
              fallosConsecutivos = 0;
              subscriber.next(payload);
            });
            evento.onerror = () => {
              // Reconexión manual: la nativa reusaría el ticket ya quemado.
              limpiar();
              registrarFallo();
            };
          },
          // Falló el ticket (401/403/404 o red): cuenta como fallo y reintenta.
          error: () => registrarFallo(),
        });
      };

      abrir();

      return () => {
        detenido = true;
        limpiar();
      };
    });
  }

  /** `POST /api/sse/ticket`: el interceptor de auth adjunta el JWT. */
  private pedirTicket(): Observable<SseTicketResponse> {
    return this.http.post<SseTicketResponse>(this.apiConfig.url('/sse/ticket'), null);
  }

  /** Parseo defensivo: JSON malformado o incompleto se descarta sin romper. */
  private parsearPayload(data: string): OtEstadoCambiado | null {
    try {
      const parsed = JSON.parse(data) as Partial<OtEstadoCambiado>;
      if (
        typeof parsed?.otId !== 'string' ||
        typeof parsed.origen !== 'string' ||
        typeof parsed.destino !== 'string'
      ) {
        return null;
      }
      return { otId: parsed.otId, origen: parsed.origen, destino: parsed.destino };
    } catch {
      return null;
    }
  }
}
