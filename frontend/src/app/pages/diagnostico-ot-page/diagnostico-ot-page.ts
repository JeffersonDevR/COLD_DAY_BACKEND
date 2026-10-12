import { ChangeDetectionStrategy, Component, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ClientesApi } from '../../core/service/clientes-api';
import { OtApi } from '../../core/service/ot-api';
import { SseService } from '../../core/service/sse.service';
import { cargarOtDesdeRuta } from '../../core/service/ot-carga';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { OtResponse, Point, TarifaEstimadaResponse } from '../../core/models/common.models';

interface ChatMensaje {
  emisor: 'CLIENTE' | 'TECNICO';
  texto: string;
  hora: string;
}

@Component({
  selector: 'app-diagnostico-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './diagnostico-ot-page.html'
})
export class DiagnosticoOtPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly sse = inject(SseService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  readonly ot = computed<OtResponse | undefined>(() => {
    return this._otRemoto();
  });

  /** Suscripción al stream de cambios de estado; se corta al destruir la página. */
  private suscripcionEstado: Subscription | null = null;

  readonly mostrarRechazo = signal<boolean>(false);
  readonly motivoRechazoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });
  readonly nuevoMensajeCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  /** Estimación de la tarifa de visita por distancia (solo lectura). */
  readonly estimacion = signal<TarifaEstimadaResponse | null>(null);

  /** Presupuesto de reparación + tarifa de visita estimada. */
  readonly totalServicio = computed<number>(
    () => (this.ot()?.presupuesto?.total || 0) + (this.estimacion()?.tarifa ?? 0)
  );

  readonly chatMensajes = signal<ChatMensaje[]>([
    { emisor: 'TECNICO', texto: 'Hola, ya realicé la revisión con manómetro. El capacitor está en 15uF cuando debe ser de 45uF. Adjunté el presupuesto formal.', hora: '10:14 AM' },
    { emisor: 'CLIENTE', texto: 'Perfecto Juan, ¿el valor incluye la garantía de 90 días?', hora: '10:15 AM' },
    { emisor: 'TECNICO', texto: 'Sí señor, incluye acta formal firmada y repuesto nuevo sellado.', hora: '10:16 AM' }
  ]);

  ngOnInit(): void {
    cargarOtDesdeRuta(
      this.route,
      this.otApi,
      (id) => {
        this.otId.set(id);
        this.escucharCambiosDeEstado(id);
      },
      (orden) => this.aplicarOt(orden),
    );
  }

  ngOnDestroy(): void {
    this.suscripcionEstado?.unsubscribe();
    this.suscripcionEstado = null;
  }

  /** Refresca la OT observada junto con su estimación de tarifa de visita. */
  private aplicarOt(orden: OtResponse | undefined): void {
    this._otRemoto.set(orden);
    this.cargarEstimacion(orden?.punto);
  }

  private recargarOt(): void {
    this.otApi.getOtById(this.otId()).subscribe({ next: (orden) => this.aplicarOt(orden) });
  }

  /**
   * Actualización en vivo (WS6): recarga la OT cuando el backend empuja un cambio
   * de estado de la misma orden, así el presupuesto refleja lo que hizo el
   * técnico sin recargar a mano. El stream es un extra: un fallo se silencia.
   */
  private escucharCambiosDeEstado(id: string): void {
    this.suscripcionEstado?.unsubscribe();
    this.suscripcionEstado = this.sse.abrirOtStream(id).subscribe({
      next: (payload) => {
        if (payload.otId === this.otId()) this.recargarOt();
      },
      error: () => {
        // El stream es solo una mejora: nunca rompe ni alerta a la página.
      },
    });
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

  etiquetaFuente(fuente: TarifaEstimadaResponse['tarifaFuente']): string {
    return fuente === 'ROAD' ? 'Ruta por carretera' : 'Distancia lineal';
  }

  aprobarPresupuesto(): void {
    this.clientesApi.aprobarDiagnostico(this.otId()).subscribe({
      next: () => {
        this.toast.success('Presupuesto Aprobado', 'El técnico ha iniciado la reparación del equipo.');
        this.router.navigate(['/cliente/ot', this.otId()]);
      }
    });
  }

  rechazarPresupuesto(): void {
    if (this.motivoRechazoCtrl.invalid) return;

    this.clientesApi.rechazarDiagnostico(this.otId(), this.motivoRechazoCtrl.value).subscribe({
      next: () => {
        this.toast.warning('Presupuesto Rechazado', 'Se abrió caso de mediación administrativa.');
        this.mostrarRechazo.set(false);
        this.router.navigate(['/cliente/ot', this.otId()]);
      }
    });
  }

  enviarMensaje(): void {
    if (this.nuevoMensajeCtrl.invalid) return;

    const texto = this.nuevoMensajeCtrl.value;
    const now = new Date();
    const hora = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.chatMensajes.update(list => [...list, { emisor: 'CLIENTE', texto, hora }]);
    this.nuevoMensajeCtrl.reset();

    // Auto-respuesta simulada del técnico
    setTimeout(() => {
      this.chatMensajes.update(list => [
        ...list,
        { emisor: 'TECNICO', texto: 'Entendido, quedo atento a cualquier duda sobre el equipo.', hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }, 1200);
  }
}
