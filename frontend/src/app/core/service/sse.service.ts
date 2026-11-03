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
  /** Instante en que se pagó la visita, si el evento lo trae (pago de visita). */
  visitaPagadaEn?: string;
}

/** Payload del evento `oferta-creada` del canal por tecnico. */
export interface OfertaCreada {
  otId: string;
}

/**
 * Actividad administrativa que el backend publica en el canal `admin`.
 * Cada valor corresponde a un hecho que ya ocurrió (se publica despues del
 * commit): el panel solo tiene que volver a leer.
 */
export type TipoActividadAdmin =
  | 'DISPUTA_ABIERTA'
  | 'DISPUTA_RESUELTA'
  | 'COMPROBANTE_CARGADO'
  | 'LIQUIDACION_REGISTRADA'
  | 'LIQUIDACION_APROBADA'
  | 'LIQUIDACION_RECHAZADA'
  | 'TECNICO_VALIDADO'
  | 'TECNICO_VALIDACION_RECHAZADA';

/** Payload del evento `admin-actividad` (contrato de `GET /api/admin/stream`). */
export interface AdminActividad {
  tipo: TipoActividadAdmin;
  /** Id interno del recurso que cambió; la pantalla no lo muestra. */
  id: string;
  /** Instante del hecho, en ISO-8601. */
  ocurridaEn: string;
}

/** Respuesta de `POST /api/sse/ticket`. */
interface SseTicketResponse {
  codigo: string;
  expiraEnSegundos: number;
}

/** Nombre del evento con el que el backend anuncia un cambio de estado. */
const EVENTO_ESTADO = 'ot-estado-cambiado';

/** Evento del canal por tecnico: se creo una nueva oferta para ese tecnico. */
const EVENTO_OFERTA_CREADA = 'oferta-creada';

/** Evento del canal de administracion: hubo actividad en el back office. */
const EVENTO_ADMIN_ACTIVIDAD = 'admin-actividad';

/**
 * Tipos de actividad aceptados. Un `tipo` fuera de esta lista se descarta: el
 * canal es un solo bucket para todos los admins y cada pantalla filtra el suyo,
 * asi que un valor desconocido solo puede ser un evento que no sabemos usar.
 */
const TIPOS_ADMIN: readonly TipoActividadAdmin[] = [
  'DISPUTA_ABIERTA',
  'DISPUTA_RESUELTA',
  'COMPROBANTE_CARGADO',
  'LIQUIDACION_REGISTRADA',
  'LIQUIDACION_APROBADA',
  'LIQUIDACION_RECHAZADA',
  'TECNICO_VALIDADO',
  'TECNICO_VALIDACION_RECHAZADA',
];

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
 * Consume los streams SSE del backend. Hay tres canales y los tres comparten
 * el mismo transporte: ticket → `EventSource` → reintento con backoff.
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
    return this.abrirCanal(
      `/ot/${otId}/stream`,
      EVENTO_ESTADO,
      (data) => this.parsearPayload(data),
      'No se pudo establecer el stream de la orden.',
    );
  }

  /** Stream frio de ofertas nuevas para el tecnico autenticado. */
  abrirOfertasTecnico(): Observable<OfertaCreada> {
    return this.abrirCanal(
      '/tecnicos/me/ofertas/stream',
      EVENTO_OFERTA_CREADA,
      (data) => this.parsearOferta(data),
      'No se pudo establecer el stream de ofertas.',
    );
  }

  /**
   * Stream frio de actividad administrativa. Un solo bucket alimenta a todos
   * los admins: el `tipo` es lo que decide que pantalla se refresca.
   */
  abrirAdminStream(): Observable<AdminActividad> {
    return this.abrirCanal(
      '/admin/stream',
      EVENTO_ADMIN_ACTIVIDAD,
      (data) => this.parsearActividad(data),
      'No se pudo establecer el stream de administración.',
    );
  }

  /**
   * Transporte común a los tres canales: pide un ticket, abre el `EventSource`
   * contra `ruta`, parsea cada evento con `parsear` y reintenta con backoff.
   *
   * `parsear` devuelve `null` para descartar un payload sin romper el stream:
   * un evento ilegible no es motivo para reconectar.
   */
  private abrirCanal<T>(
    ruta: string,
    evento: string,
    parsear: (data: string) => T | null,
    mensajeError: string,
  ): Observable<T> {
    // Sin backend (mock) o sin EventSource (SSR): no hay nada que abrir.
    if (this.apiConfig.useMocks()) return EMPTY;
    if (typeof EventSource === 'undefined') return EMPTY;

    return new Observable<T>((subscriber) => {
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
          subscriber.error(new Error(mensajeError));
          return;
        }
        programarReintento();
      };

      const abrir = (): void => {
        if (detenido) return;
        this.pedirTicket().subscribe({
          next: (ticket) => {
            if (detenido) return;
            const url = `${this.apiConfig.url(ruta)}?ticket=${encodeURIComponent(ticket.codigo)}`;
            const source = new EventSource(url);
            fuente = source;
            source.onopen = () => {
              // Solo se registra el instante de apertura: el contador NO se
              // resetea acá, porque eso permitiría un bucle infinito contra un
              // servidor que acepta y cierra de inmediato.
              conexionAbiertaEn = Date.now();
            };
            source.addEventListener(evento, (mensaje: MessageEvent) => {
              const payload = parsear(mensaje.data);
              // Un payload inválido se descarta; el stream sigue vivo.
              if (!payload) return;
              fallosConsecutivos = 0;
              subscriber.next(payload);
            });
            source.onerror = () => {
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

  /** Parseo defensivo del payload del canal de ofertas (solo exige otId). */
  private parsearOferta(data: string): OfertaCreada | null {
    try {
      const parsed = JSON.parse(data) as Partial<OfertaCreada>;
      if (typeof parsed?.otId !== 'string') return null;
      return { otId: parsed.otId };
    } catch {
      return null;
    }
  }

  /**
   * Parseo defensivo del canal de administración: exige la forma completa del
   * contrato (`tipo`, `id`, `ocurridaEn`) y descarta tipos que no conocemos.
   */
  private parsearActividad(data: string): AdminActividad | null {
    try {
      const parsed = JSON.parse(data) as Partial<AdminActividad>;
      if (
        typeof parsed?.tipo !== 'string' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.ocurridaEn !== 'string'
      ) {
        return null;
      }
      const tipo = parsed.tipo as TipoActividadAdmin;
      if (!TIPOS_ADMIN.includes(tipo)) return null;
      return { tipo, id: parsed.id, ocurridaEn: parsed.ocurridaEn };
    } catch {
      return null;
    }
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
      return {
        otId: parsed.otId,
        origen: parsed.origen,
        destino: parsed.destino,
        visitaPagadaEn: typeof parsed.visitaPagadaEn === 'string' ? parsed.visitaPagadaEn : undefined,
      };
    } catch {
      return null;
    }
  }
}
