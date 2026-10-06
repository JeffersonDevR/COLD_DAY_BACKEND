import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { cargarOtDesdeRuta } from '../../ot/infrastructure/ot-carga';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { ActaGarantia, OtResponse, MedioPago, Point, TarifaEstimadaResponse } from '../../../core/models/common.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-pago-acta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-4xl mx-auto">
        <div>
          <a [routerLink]="['/cliente/ot', orden.id]" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <i class="pi pi-arrow-left text-xs"></i> Volver al Seguimiento
          </a>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Liquidación, Pago y Acta de Garantía
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            OT: {{ orden.id }} • Certificación de entrega a satisfacción con 90 días de amparo
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Columna Izquierda: Acta Formal y Firma Digital -->
          <div class="md:col-span-2 space-y-6">
            <!-- Documento Acta de Garantía -->
            <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                    <i class="pi pi-verified"></i>
                  </div>
                  <div>
                    <h2 class="text-base font-extrabold text-slate-900 dark:text-slate-100">COLD DAY S.A.S.</h2>
                    <span class="text-xs text-slate-400">NIT 901.849.201-4 • Cúcuta, N. de S.</span>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  Garantía 90 Días
                </span>
              </div>

              <!-- Cláusula de Garantía -->
              <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
                <p>
                  <strong>ACTA DE CONFORMIDAD Y SERVICIO:</strong> Se certifica que el técnico <strong>{{ orden.tecnicoNombre || 'Asignado' }}</strong> ha ejecutado a conformidad el servicio de {{ orden.categoriaServicio.replace('_', ' ') }} en el inmueble ubicado en <strong>{{ orden.direccion }}</strong> ({{ orden.barrio || 'Cúcuta' }}).
                </p>
                <p>
                  La labor y repuestos homologados cuentan con una cobertura legal y operativa de <strong>90 días calendario</strong> a partir de la fecha de suscripción del presente documento, amparada por la póliza y auditoría de COLD DAY S.A.S.
                </p>
              </div>

              <!-- Canvas de Firma Digital (Táctil / Ratón) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Firma Digital de Conformidad del Cliente *
                  </span>
                  <button
                    type="button"
                    (click)="limpiarFirma()"
                    class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1"
                  >
                    <i class="pi pi-times text-xs" style="font-size: 14px; width:14px; height:14px;"></i> Limpiar firma
                  </button>
                </div>

                <div class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden relative">
                  <canvas
                    #signatureCanvas
                    width="480"
                    height="140"
                    (mousedown)="startDrawing($event)"
                    (mousemove)="draw($event)"
                    (mouseup)="stopDrawing()"
                    (mouseleave)="stopDrawing()"
                    (touchstart)="startTouch($event)"
                    (touchmove)="drawTouch($event)"
                    (touchend)="stopDrawing()"
                    class="w-full h-[140px] cursor-crosshair touch-none"
                  ></canvas>
                  @if (!hasFirma()) {
                    <div class="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 dark:text-slate-700 text-xs font-semibold">
                      Dibuja tu firma digital aquí con el dedo o mouse
                    </div>
                  }
                </div>
              </div>

              <!-- Botón Generar y Descargar Acta -->
              <div class="flex justify-between items-center pt-2">
                <button
                  type="button"
                  [disabled]="!hasFirma() || guardando() || !!acta()"
                  (click)="guardarYDescargarActa()"
                  class="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors inline-flex items-center gap-2"
                >
                  @if (guardando()) {
                    <i class="pi pi-spin pi-spinner text-sm"></i>
                    Registrando el acta…
                  } @else if (acta(); as actaFirmada) {
                    <i class="pi pi-verified text-sm"></i>
                    Acta registrada
                  } @else {
                    <i class="pi pi-download text-sm"></i>
                    Descargar Acta de Garantía Firmada
                  }
                </button>
                @if (acta(); as actaFirmada) {
                  <!--
                    El código es el que devolvió el servidor. Antes se armaba
                    acá mismo con el id de la OT (CD-SEC-...), una cadena que
                    no existía en ninguna base y que el cliente daba por
                    verificable. Sin un 2xx real no se muestra código alguno.
                  -->
                  <span class="text-xs text-slate-500 dark:text-slate-400 text-right">
                    Código de verificación:
                    <strong class="font-mono text-slate-700 dark:text-slate-200">{{ actaFirmada.codigoVerificacion }}</strong>
                  </span>
                } @else {
                  <span class="text-xs text-slate-400 text-right">
                    Sin firmar — aún no hay acta registrada
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Detalle Financiero y Medio de Pago -->
          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Liquidación del Pago
              </h3>

              <div class="space-y-2 text-xs">
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Visita y diagnóstico:</span>
                  <span class="font-bold">
                    @if (estimacion(); as est) {
                      {{ est.tarifa !== null ? ('$ ' + est.tarifa.toLocaleString('es-CO')) : 'Por confirmar' }}
                    } @else {
                      —
                    }
                  </span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Mano de Obra:</span>
                  <span class="font-bold">$ {{ (orden.presupuesto?.manoDeObra || 80000).toLocaleString('es-CO') }}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Repuestos:</span>
                  <span class="font-bold">$ {{ (orden.presupuesto?.repuestos || 70000).toLocaleString('es-CO') }}</span>
                </div>
                <div class="flex justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-black text-sm">
                  <span>Total a Pagar:</span>
                  <span>$ {{ totalMonto().toLocaleString('es-CO') }} COP</span>
                </div>
              </div>

              <!-- Selector de Medio de Pago -->
              <div>
                <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Medio de Pago Utilizado:
                </span>
                <div class="space-y-2">
                  <button
                    type="button"
                    (click)="medioPago.set('EFECTIVO')"
                    class="w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-colors"
                    [class.border-sky-500]="medioPago() === 'EFECTIVO'"
                    [class.bg-sky-50]="medioPago() === 'EFECTIVO'"
                    [class.dark:bg-sky-950/40]="medioPago() === 'EFECTIVO'"
                    [class.border-slate-200]="medioPago() !== 'EFECTIVO'"
                    [class.dark:border-slate-700]="medioPago() !== 'EFECTIVO'"
                  >
                    <div class="flex items-center gap-2">
                      <i class="pi pi-money-bill text-emerald-600 text-sm"></i>
                      <span class="font-bold">Efectivo en Sitio</span>
                    </div>
                    <span class="text-[11px] text-slate-400">Entregado al técnico</span>
                  </button>

                  <button
                    type="button"
                    (click)="medioPago.set('TRANSFERENCIA')"
                    class="w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-colors"
                    [class.border-sky-500]="medioPago() === 'TRANSFERENCIA'"
                    [class.bg-sky-50]="medioPago() === 'TRANSFERENCIA'"
                    [class.dark:bg-sky-950/40]="medioPago() === 'TRANSFERENCIA'"
                    [class.border-slate-200]="medioPago() !== 'TRANSFERENCIA'"
                    [class.dark:border-slate-700]="medioPago() !== 'TRANSFERENCIA'"
                  >
                    <div class="flex items-center gap-2">
                      <i class="pi pi-building-columns text-sky-600 text-sm"></i>
                      <span class="font-bold">Transferencia Bancaria</span>
                    </div>
                    <span class="text-[11px] text-slate-400">Bancolombia / Nequi</span>
                  </button>
                </div>
              </div>

              <!-- Retención de Comisión de Plataforma (Transparencia COLD DAY) -->
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 space-y-1">
                <div class="flex justify-between font-semibold">
                  <span>Comisión COLD DAY ({{ environment.commissionRate * 100 }}%):</span>
                  <span>$ {{ (totalMonto() * environment.commissionRate).toLocaleString('es-CO') }}</span>
                </div>
                <div class="flex justify-between font-semibold">
                  <span>Monto Líquido Técnico ({{ (1 - environment.commissionRate) * 100 }}%):</span>
                  <span>$ {{ (totalMonto() * (1 - environment.commissionRate)).toLocaleString('es-CO') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `
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
