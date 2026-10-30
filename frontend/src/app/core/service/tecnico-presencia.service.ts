import { Injectable, computed, inject, signal } from '@angular/core';
import { EstadoOt, OtResponse } from '../models/common.models';
import { TecnicoTrackingService } from './tecnico-tracking.service';

/**
 * Preferencia del dispositivo: el técnico DISPONIBLE decide si quiere estar en
 * el radar de clientes. Persiste al refresh porque no es una sesión de trabajo,
 * es una decisión del técnico sobre su propia visibilidad.
 */
export const CLAVE_COMPARTIR_UBICACION = 'coldday.tecnico.compartir-ubicacion';

/**
 * Estados de la OT en los que el técnico está trabajando. Mientras exista una
 * orden asignada en alguno de estos estados, el reporte de ubicación está
 * encendido sin intervención: el cliente tiene que poder seguirlo.
 */
const ESTADOS_OT_EN_MOVIMIENTO: ReadonlySet<EstadoOt> = new Set<EstadoOt>([
  'ASIGNADA',
  'EN_CAMINO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
]);

/**
 * Por qué se está reportando (o no). Es la única fuente de verdad de la UI:
 * el panel y la ejecución describen este valor, no lo recalculan.
 */
export type ModoPresencia = 'ejecutando' | 'compartiendo' | 'apagada';

/**
 * Política ÚNICA de presencia del técnico: decide si el GPS publica posición.
 *
 * Reglas (en este orden):
 * 1. Con una OT en movimiento, reportar siempre. No hay botón que apagar.
 * 2. Sin OT en movimiento, manda el switch persistido ("compartir ubicación
 *    para recibir ofertas").
 * 3. En cualquier otro caso, no reportar: sin reporte el radar no lista al
 *    técnico (el backend exige tracking activo y ubicación fresca).
 *
 * El servicio es un singleton de root y no posee temporizadores propios: el
 * watch sigue viviendo en `TecnicoTrackingService`, con su gate de pestaña
 * visible. Acá solo se llama `iniciar()`/`detener()`, de forma idempotente,
 * para que ejecutar la política muchas veces no abra suscripciones de más.
 */
@Injectable({
  providedIn: 'root',
})
export class TecnicoPresenciaService {
  private readonly tracking = inject(TecnicoTrackingService);

  /** Preferencia restaurada al crear el servicio (refresh / reapertura de la app). */
  readonly compartirUbicacion = signal<boolean>(leerPreferencia());

  /** Contexto de trabajo: hay una OT asignada en un estado de movimiento. */
  private readonly otEnMovimiento = signal<boolean>(false);

  readonly modo = computed<ModoPresencia>(() => {
    if (this.otEnMovimiento()) return 'ejecutando';
    return this.compartirUbicacion() ? 'compartiendo' : 'apagada';
  });

  /**
   * Con una OT en curso el switch queda bloqueado encendido: apagarlo dejaría
   * al cliente sin rastro justo cuando lo está esperando.
   */
  readonly switchBloqueado = computed<boolean>(() => this.modo() === 'ejecutando');

  /** Reporte efectivo: la política quiere reportar y el GPS no falló. */
  readonly reportando = computed<boolean>(
    () => this.modo() !== 'apagada' && this.tracking.activo() && !this.tracking.motivo(),
  );

  /** Causa legible cuando el GPS rechazó el permiso o falló (`null` si no hay fallo). */
  readonly motivo = computed<string | null>(() => this.tracking.motivo());

  /**
   * Último estado aplicado al tracking. Evita reabrir el watch en cada refresco
   * del panel (25 s) cuando la decisión no cambió.
   */
  private aplicado: boolean | null = null;

  /** Contexto del panel: las OTs asignadas al técnico autenticado. */
  sincronizarOts(ots: readonly OtResponse[]): void {
    this.otEnMovimiento.set(ots.some((ot) => ESTADOS_OT_EN_MOVIMIENTO.has(ot.estado)));
    this.aplicar();
  }

  /**
   * Contexto de la página de ejecución: la OT abierta. Sin OT cargada
   * (`undefined` mientras llega el GET) no se toca la decisión anterior.
   */
  sincronizarOt(ot: OtResponse | undefined | null): void {
    if (!ot) return;
    this.otEnMovimiento.set(ESTADOS_OT_EN_MOVIMIENTO.has(ot.estado));
    this.aplicar();
  }

  /**
   * La página de ejecución dejó de tener contexto (navegación o cierre). La
   * preferencia del switch vuelve a decidir: salir de la ejecución ya no apaga
   * el reporte que el panel tenía encendido.
   */
  liberarContexto(): void {
    this.otEnMovimiento.set(false);
    this.aplicar();
  }

  /** El técnico enciende el switch. Persiste y reintenta si el GPS había fallado. */
  activar(): void {
    this.compartirUbicacion.set(true);
    guardarPreferencia(true);
    this.aplicar(true);
  }

  /** El técnico apaga el switch. Persiste y corta el reporte. */
  desactivar(): void {
    this.compartirUbicacion.set(false);
    guardarPreferencia(false);
    this.aplicar(true);
  }

  /** Reintento explícito del reporte tras un fallo de GPS (permiso, timeout). */
  reintentar(): void {
    if (this.modo() === 'apagada') return;
    this.aplicar(true);
  }

  /**
   * Aplica la decisión al tracking.
   *
   * `forzar` se usa cuando el técnico pidió algo explícito (encender, apagar,
   * reintentar): ahí sí vale volver a intentar aunque el estado deseado no
   * haya cambiado.
   */
  private aplicar(forzar = false): void {
    // Mismas dos fuentes que `modo`, sin pasar por el computed: el contexto de
    // OT suele escribirse justo antes de aplicar y no hace falta invalidarlo.
    const debeReportar = this.otEnMovimiento() || this.compartirUbicacion();
    if (!forzar && this.aplicado === debeReportar) return;
    this.aplicado = debeReportar;
    if (debeReportar) {
      this.tracking.iniciar();
    } else {
      this.tracking.detener();
    }
  }
}

/** Preferencia guardada; por defecto apagada (nadie comparte ubicación por accidente). */
function leerPreferencia(): boolean {
  const almacen = almacenamiento();
  if (!almacen) return false;
  try {
    return almacen.getItem(CLAVE_COMPARTIR_UBICACION) === 'true';
  } catch {
    return false;
  }
}

/** Preferencia best-effort: sin almacenamiento la sesión sigue funcionando. */
function guardarPreferencia(valor: boolean): void {
  const almacen = almacenamiento();
  if (!almacen) return;
  try {
    almacen.setItem(CLAVE_COMPARTIR_UBICACION, String(valor));
  } catch {
    // Navegador con almacenamiento bloqueado: la decisión vive solo en memoria.
  }
}

/** `localStorage` puede no existir (SSR) o estar bloqueado por el navegador. */
function almacenamiento(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
