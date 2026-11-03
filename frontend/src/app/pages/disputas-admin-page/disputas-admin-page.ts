import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { AdminApi } from '../../core/service/admin-api';
import { refrescarConActividadAdmin } from '../../core/service/admin-actividad-refresco';
import { SseService, TipoActividadAdmin } from '../../core/service/sse.service';
import { AuthService } from '../../core/service/auth.service';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { DisputaResponse } from '../../core/models/common.models';
import { CargaError } from '../../shared/carga-error/carga-error';

/** Actividad administrativa que cambia esta bandeja. */
const TIPOS_DISPUTA: readonly TipoActividadAdmin[] = ['DISPUTA_ABIERTA', 'DISPUTA_RESUELTA'];

@Component({
  selector: 'app-disputas-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, CargaError],
  templateUrl: './disputas-admin-page.html'
})
export class DisputasAdminPage {
  private readonly adminApi = inject(AdminApi);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  /** Canal admin; `null` sin backend SSE (mock/SSR/specs): la bandeja sigue igual. */
  private readonly sse = inject(SseService, { optional: true });
  private readonly destruir = inject(DestroyRef);

  readonly disputas = signal<DisputaResponse[]>([]);
  readonly disputaSeleccionada = signal<DisputaResponse | null>(null);
  readonly resolucionCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] });

  /** Carga silenciosa: si falla, la bandeja lo dice y ofrece reintentar. */
  readonly cargando = signal<boolean>(false);
  readonly errorCarga = signal<boolean>(false);

  constructor() {
    this.cargarDisputas();
    // Solo las disputas mueven esta bandeja; el resto de la actividad del
    // back office no merece una recarga acá.
    refrescarConActividadAdmin({
      sse: this.sse,
      destruir: this.destruir,
      tipos: TIPOS_DISPUTA,
      recargar: () => this.recargarDisputas(),
    });
  }

  cargarDisputas(): void {
    this.recargarDisputas().subscribe();
  }

  /** Carga las disputas y expone su final para no solapar dos recargas. */
  private recargarDisputas(): Observable<unknown> {
    this.cargando.set(true);
    this.errorCarga.set(false);
    return this.adminApi.getTodasDisputas().pipe(
      tap((disputas) => this.disputas.set(disputas)),
      catchError(() => {
        this.disputas.set([]);
        this.errorCarga.set(true);
        return of(null);
      }),
      finalize(() => this.cargando.set(false)),
    );
  }

  abrirResolucion(d: DisputaResponse): void {
    this.disputaSeleccionada.set(d);
  }

  resolver(acuerdo: boolean): void {
    const d = this.disputaSeleccionada();
    if (!d || this.resolucionCtrl.invalid) return;

    const admin = this.authService.currentUser()?.nombre || 'Administrador COLD DAY';
    this.adminApi.resolverDisputa(d.id, this.resolucionCtrl.value, acuerdo, admin).subscribe({
      next: () => {
        this.toast.success('Disputa Resuelta', `La disputa de la OT ${d.otCodigo || 'Sin código'} ha sido conciliada satisfactoriamente.`);
        this.disputaSeleccionada.set(null);
        this.resolucionCtrl.reset();
        this.cargarDisputas();
      },
      // El modal queda abierto con el dictamen escrito para que el admin reintente.
      error: (err) => {
        avisarErrorAccion(this.toast, 'No se pudo resolver la disputa', err);
      },
    });
  }
}
