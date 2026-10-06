import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OtApi } from '../../modules/ot/infrastructure/ot-api';
import { cargarOtDesdeRuta } from '../../modules/ot/infrastructure/ot-carga';
import { ToastService } from '../../core/alertas/toast.service';
import { ActaGarantia, OtResponse, MedioPago, Point, TarifaEstimadaResponse } from '../../core/models/common.models';
import { environment } from '../../core/environment/environment';

@Component({
  selector: 'app-pago-acta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './pago-acta-page.html'
})
export class PagoActaPage implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly otApi = inject(OtApi);
  private readonly toast = inject(ToastService);

  /** Expuesto al template para derivar comisión y monto líquido. */
  readonly environment = environment;

  @ViewChild('signatureCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  readonly ot = computed<OtResponse | undefined>(() => this._otRemoto());

  readonly medioPago = signal<MedioPago>('EFECTIVO');
  readonly hasFirma = signal<boolean>(false);

  /**
   * Acta ya registrada, tal como la devolvió el servidor. Mientras sea `null`
   * NO hay acta: la página no puede afirmar que existe ni inventar un código de
   * verificación para llenar el hueco.
   */
  readonly acta = signal<ActaGarantia | null>(null);

  /** Petición en vuelo: deshabilita el botón y evita el doble envío. */
  readonly guardando = signal<boolean>(false);

  private isDrawing = false;
  private ctx: CanvasRenderingContext2D | null = null;

  /** Tarifa de visita estimada por distancia para el punto de servicio. */
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  readonly totalMonto = computed(() => {
    return (this.ot()?.presupuesto?.total || 0) + (this.estimacion()?.tarifa ?? 0);
  });

  ngOnInit(): void {
    cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => this.otId.set(id),
      (orden) => {
        this._otRemoto.set(orden);
        this.cargarEstimacion(orden?.punto);
      },
    );
  }

  /** Consulta la tarifa de visita por distancia para el punto de servicio. */
  private cargarEstimacion(punto?: Point): void {
    if (!punto) {
      this.estimacion.set(null);
      return;
    }
    this.otApi.estimarTarifa(punto).subscribe({
      next: (est) => this.estimacion.set(est),
      error: () => this.estimacion.set(null),
    });
  }

  ngAfterViewInit(): void {
    if (this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d');
      if (this.ctx) {
        this.ctx.strokeStyle = '#0284c7';
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
      }
    }
  }

  startDrawing(e: MouseEvent): void {
    this.isDrawing = true;
    if (this.ctx && this.canvasRef) {
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      this.ctx.beginPath();
      this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  draw(e: MouseEvent): void {
    if (!this.isDrawing || !this.ctx || !this.canvasRef) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    this.ctx.stroke();
    this.hasFirma.set(true);
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  startTouch(e: TouchEvent): void {
    if (e.touches.length > 0) {
      this.isDrawing = true;
      const touch = e.touches[0];
      if (this.ctx && this.canvasRef) {
        const rect = this.canvasRef.nativeElement.getBoundingClientRect();
        this.ctx.beginPath();
        this.ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    }
  }

  drawTouch(e: TouchEvent): void {
    if (!this.isDrawing || !this.ctx || !this.canvasRef || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    this.ctx.stroke();
    this.hasFirma.set(true);
  }

  limpiarFirma(): void {
    if (this.ctx && this.canvasRef) {
      this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
      this.hasFirma.set(false);
    }
  }

  /**
   * Persiste el acta de garantía firmada.
   *
   * Esto antes era un toast y nada más: la firma del <canvas> se descartaba y
   * el "código de verificación" se fabricaba en el template. Bajo la Ley 1480
   * ese documento es la prueba del consumidor de 90 días de garantía, así que
   * el éxito solo se anuncia cuando el servidor respondió 2xx con un código
   * emitido por él, y el error real se muestra cuando no.
   *
   * El botón queda deshabilitado mientras la petición está en vuelo porque el
   * acta se firma UNA vez: un doble envío sería un 409 y, peor, le diría al
   * cliente que su documento falló cuando lo que pasó fue que hizo clic dos
   * veces.
   */
  guardarYDescargarActa(): void {
    if (this.guardando() || this.acta()) return;

    const firmaDataUrl = this.exportarFirma();
    if (!firmaDataUrl) {
      this.toast.error('No pudimos registrar tu acta', 'Vuelve a dibujar tu firma e inténtalo de nuevo.');
      return;
    }

    this.guardando.set(true);
    this.otApi.firmarActaGarantia(this.otId(), firmaDataUrl).subscribe({
      next: (acta) => {
        // Un 2xx sin código no es prueba de nada: el código es lo que hace
        // verificable el acta. Si faltara, se reporta como error en vez de
        // anunciarlo como generado.
        if (!acta?.codigoVerificacion) {
          this.toast.error(
            'No pudimos registrar tu acta',
            'El servidor respondió sin un código de verificación, así que no hay acta que mostrar.',
          );
          return;
        }
        this.acta.set(acta);
        this.toast.success(
          'Acta registrada',
          `Firma y acta guardadas. Tu código de verificación es ${acta.codigoVerificacion}.`,
        );
      },
      error: (err: Error) => {
        // Se muestra el mensaje real del backend (409 por OT no finalizada o
        // acta ya firmada, 400 por firma vacía o demasiado grande, 403 si la
        // orden no es del cliente). Un "éxito" acá volvería a mentir.
        this.toast.error('No pudimos registrar tu acta', err.message);
      },
      complete: () => this.guardando.set(false),
    });
  }

  /**
   * Exporta el trazo del canvas como data URL. `toDataURL` sobre un canvas
   * vacío igual devuelve una cadena (un PNG en blanco), así que un data URL
   * vacío significa que el elemento no está disponible todavía.
   */
  private exportarFirma(): string | null {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl && dataUrl.length > 0 ? dataUrl : null;
    } catch {
      // Un canvas contaminado (imagen externa) lanza SecurityError al
      // exportar: es un fallo real de la firma, no algo que deba reportarse
      // como acta registrada.
      return null;
    }
  }
}
