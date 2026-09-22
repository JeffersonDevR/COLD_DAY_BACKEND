import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientesApi } from '../infrastructure/clientes-api';
import { OtApi } from '../../ot/infrastructure/ot-api';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { OtResponse } from '../../../core/shared/domain/models/common.models';
import { environment } from '../../../../environments/environment';

interface ChatMensaje {
  emisor: 'CLIENTE' | 'TECNICO';
  texto: string;
  hora: string;
}

@Component({
  selector: 'app-diagnostico-ot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    @if (ot(); as orden) {
      <div class="space-y-6 max-w-4xl mx-auto">
        <div>
          <a [routerLink]="['/cliente/ot', orden.id]" class="text-xs font-semibold text-sky-600 hover:text-sky-500 inline-flex items-center gap-1 mb-1">
            <i class="pi pi-arrow-left text-xs"></i> Volver al Seguimiento de OT
          </a>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Diagnóstico Técnico y Presupuesto
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Revisión en sitio por {{ orden.tecnicoNombre || 'el técnico asignado' }}
          </p>
        </div>

        <!-- Presupuesto y Diagnóstico -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-6">
            <!-- Tarjeta Diagnóstico Técnico -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <i class="pi pi-wrench"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Dictamen Técnico Oficial</h3>
                  <span class="text-xs text-slate-400">Inspección de compresor, fugas y circuitería</span>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {{ orden.diagnostico || 'Diagnóstico preliminar: condensador sucio, capacitor desvalorizado y fuga leve de refrigerante en soldadura de baja presión.' }}
              </div>

              <!-- Desglose de Costos Transparente -->
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Desglose de Costos de Intervención (COP)
                </h4>
                <div class="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs sm:text-sm">
                  <div class="flex justify-between p-3.5 bg-sky-50/70 dark:bg-sky-950/25 border-b border-slate-100 dark:border-slate-800">
                    <div class="space-y-0.5">
                      <span class="font-bold text-slate-800 dark:text-slate-200">Visita y diagnóstico</span>
                      <p class="text-[11px] text-slate-400">
                        Diagnóstico $ {{ diagnosticoPrecio.toLocaleString('es-CO') }} + transporte $ {{ transportePrecio.toLocaleString('es-CO') }}
                      </p>
                    </div>
                    <span class="font-bold text-slate-900 dark:text-slate-100">
                      $ {{ cargoVisita.toLocaleString('es-CO') }}
                    </span>
                  </div>

                  <div class="flex justify-between p-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div class="space-y-0.5">
                      <span class="font-bold text-slate-800 dark:text-slate-200">Mano de Obra Certificada</span>
                      <p class="text-[11px] text-slate-400">Tiempo estimado: {{ orden.presupuesto?.tiempoEstimadoHoras || 2 }} hora(s)</p>
                    </div>
                    <span class="font-bold text-slate-900 dark:text-slate-100">
                      $ {{ (orden.presupuesto?.manoDeObra || 80000).toLocaleString('es-CO') }}
                    </span>
                  </div>

                  <div class="flex justify-between p-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div class="space-y-0.5">
                      <span class="font-bold text-slate-800 dark:text-slate-200">Repuestos & Materiales Homologados</span>
                      <p class="text-[11px] text-slate-400">Capacitor 45uF + gas ecológico R410A</p>
                    </div>
                    <span class="font-bold text-slate-900 dark:text-slate-100">
                      $ {{ (orden.presupuesto?.repuestos || 70000).toLocaleString('es-CO') }}
                    </span>
                  </div>

                  <div class="flex justify-between p-4 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 font-extrabold text-sm sm:text-base">
                    <span>Total a Autorizar</span>
                    <span>$ {{ totalServicio().toLocaleString('es-CO') }} COP</span>
                  </div>
                </div>
                <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  La visita y el diagnóstico ({{ cargoVisita.toLocaleString('es-CO') }} COP) se cobran aunque no apruebes la reparación.
                </p>
              </div>

              <!-- Botones de Acción -->
              @if (orden.estado === 'EN_DIAGNOSTICO') {
                <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
                  <button
                    type="button"
                    (click)="mostrarRechazo.set(true)"
                    class="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <i class="pi pi-thumbs-down text-sm"></i>
                    Rechazar Presupuesto
                  </button>

                  <button
                    type="button"
                    (click)="aprobarPresupuesto()"
                    class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors inline-flex items-center gap-1.5"
                  >
                    <i class="pi pi-thumbs-up text-sm"></i>
                    Aprobar e Iniciar Reparación
                  </button>
                </div>
              } @else {
                <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <i class="pi pi-check-circle text-sm"></i>
                  <span>Presupuesto gestionado con éxito. Estado actual: <strong>{{ orden.estado }}</strong></span>
                </div>
              }
            </div>

            <!-- Formulario de Rechazo con Motivo Obligatorio -->
            @if (mostrarRechazo()) {
              <div class="p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
                <div class="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                  <i class="pi pi-shield text-sm"></i>
                  Motivo de Rechazo (Apertura de Disputa / Mediación)
                </div>
                <textarea
                  rows="3"
                  [formControl]="motivoRechazoCtrl"
                  placeholder="Explica la discrepancia en repuestos, costo o tiempo estimado para que el área de soporte intervenga..."
                  class="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-rose-500"
                ></textarea>
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    (click)="mostrarRechazo.set(false)"
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    [disabled]="motivoRechazoCtrl.invalid"
                    (click)="rechazarPresupuesto()"
                    class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs"
                  >
                    Confirmar Rechazo y Abrir Disputa
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Chat Directo con el Técnico -->
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[500px]">
            <div class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div class="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold text-sm">
                {{ orden.tecnicoNombre?.charAt(0) || 'T' }}
              </div>
              <div class="min-w-0">
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{{ orden.tecnicoNombre }}</h4>
                <span class="text-[11px] text-emerald-600 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> En Línea
                </span>
              </div>
            </div>

            <!-- Lista de Mensajes -->
            <div class="flex-1 overflow-y-auto py-3 space-y-3 text-xs pr-1">
              @for (msg of chatMensajes(); track $index) {
                <div [class.text-right]="msg.emisor === 'CLIENTE'" [class.text-left]="msg.emisor === 'TECNICO'">
                  <div
                    class="inline-block p-3 rounded-2xl max-w-[85%] text-left"
                    [class.bg-sky-600]="msg.emisor === 'CLIENTE'"
                    [class.text-white]="msg.emisor === 'CLIENTE'"
                    [class.bg-slate-100]="msg.emisor === 'TECNICO'"
                    [class.dark:bg-slate-800]="msg.emisor === 'TECNICO'"
                    [class.text-slate-800]="msg.emisor === 'TECNICO'"
                    [class.dark:text-slate-200]="msg.emisor === 'TECNICO'"
                  >
                    <p class="leading-relaxed">{{ msg.texto }}</p>
                    <span class="text-[10px] opacity-70 block mt-1 text-right">{{ msg.hora }}</span>
                  </div>
                </div>
              }
            </div>

            <!-- Envío de Mensaje -->
            <form (ngSubmit)="enviarMensaje()" class="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                [formControl]="nuevoMensajeCtrl"
                placeholder="Escribe al técnico..."
                class="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                [disabled]="nuevoMensajeCtrl.invalid"
                class="w-9 h-9 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white flex items-center justify-center shrink-0"
              >
                <i class="pi pi-send text-sm"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    }
  `
})
export class DiagnosticoOtPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientesApi = inject(ClientesApi);
  private readonly otApi = inject(OtApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly otId = signal<string>('');
  private readonly _otRemoto = signal<OtResponse | undefined>(undefined);
  readonly ot = computed<OtResponse | undefined>(() => {
    return this._otRemoto();
  });

  readonly mostrarRechazo = signal<boolean>(false);
  readonly motivoRechazoCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });
  readonly nuevoMensajeCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  /** Cargo fijo de visita + diagnóstico (diagnóstico estándar + transporte). */
  readonly diagnosticoPrecio = environment.diagnosticoPrecio;
  readonly transportePrecio = environment.transportePrecio;
  readonly cargoVisita = environment.diagnosticoPrecio + environment.transportePrecio;

  /** Presupuesto de reparación + cargo de visita/diagnóstico. */
  readonly totalServicio = computed<number>(
    () => (this.ot()?.presupuesto?.total || 150000) + this.cargoVisita
  );

  readonly chatMensajes = signal<ChatMensaje[]>([
    { emisor: 'TECNICO', texto: 'Hola, ya realicé la revisión con manómetro. El capacitor está en 15uF cuando debe ser de 45uF. Adjunté el presupuesto formal.', hora: '10:14 AM' },
    { emisor: 'CLIENTE', texto: 'Perfecto Juan, ¿el valor incluye la garantía de 90 días?', hora: '10:15 AM' },
    { emisor: 'TECNICO', texto: 'Sí señor, incluye acta formal firmada y repuesto nuevo sellado.', hora: '10:16 AM' }
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.otId.set(id);
        this.otApi.getOtById(id).subscribe({
          next: (orden) => this._otRemoto.set(orden),
        });
      }
    });
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
