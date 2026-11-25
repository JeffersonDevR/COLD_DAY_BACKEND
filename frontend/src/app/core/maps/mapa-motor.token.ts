import { InjectionToken, computed, inject, signal } from '@angular/core';
import { MapaConfigService } from '../service/mapa-config.service';
import { GoogleMotor } from './google-motor';
import { MapaInstancia, MapaMotor, MapaOpciones } from './mapa-motor';

/**
 * Elige el motor según el proveedor que publica el backend. Un valor ausente o
 * desconocido cae a Google: un proveedor mal escrito no debe dejar la app sin
 * mapa. Para sumar un proveedor: crear su `MapaMotor` y añadir su caso aquí.
 */
function elegir(proveedor: string, google: GoogleMotor): MapaMotor {
  switch (proveedor) {
    case 'google':
    default:
      return google;
  }
}

/**
 * Motor perezoso: el proveedor se decide cuando llega la configuración del
 * backend (primer `cargar()` o `reintentar()`), no al inyectarse. En el móvil la
 * config no se pide al arrancar, así que leerla al construir fijaría `google`
 * para toda la sesión aunque el backend publicara otro.
 */
class MotorSeleccionado extends MapaMotor {
  private readonly config = inject(MapaConfigService);
  private readonly google = inject(GoogleMotor);

  private readonly elegido = signal<MapaMotor | null>(null);
  private readonly resolviendo = signal(false);
  private espera: Promise<MapaMotor> | null = null;

  get nombre(): string {
    return this.elegido()?.nombre ?? 'pendiente';
  }

  readonly listo = computed(() => this.elegido()?.listo() ?? false);
  readonly cargando = computed(() => {
    const motor = this.elegido();
    return motor ? motor.cargando() : this.resolviendo();
  });

  async cargar(): Promise<boolean> {
    return (await this.resolver()).cargar();
  }

  async reintentar(): Promise<boolean> {
    return (await this.resolver()).reintentar();
  }

  crear(el: HTMLElement, opciones: MapaOpciones): MapaInstancia {
    const motor = this.elegido();
    if (!motor) throw new Error('El motor de mapa aún no está listo');
    return motor.crear(el, opciones);
  }

  /** Espera la config una sola vez y fija el motor; las llamadas siguientes lo reutilizan. */
  private resolver(): Promise<MapaMotor> {
    this.espera ??= (async () => {
      this.resolviendo.set(true);
      try {
        await this.config.cargar();
        const motor = elegir(this.config.proveedor(), this.google);
        this.elegido.set(motor);
        return motor;
      } finally {
        this.resolviendo.set(false);
      }
    })();
    return this.espera;
  }
}

export const MAPA_MOTOR = new InjectionToken<MapaMotor>('MAPA_MOTOR', {
  providedIn: 'root',
  factory: () => new MotorSeleccionado(),
});
