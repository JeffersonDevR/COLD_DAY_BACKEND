import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToolbar,
} from '@ionic/angular';
import { ApiHttpError } from '@core/alertas/api-http.error';
import { AuthService } from '@core/service/auth.service';
import { SolicitudesPerfilApi } from '@core/service/solicitudes-perfil-api';
import { ModoApp, ORDEN_MODOS } from '../../modo/modo';
import { ModoService } from '../../modo/modo.service';
import { ErrorAlertComponent } from '../../shared/ui/error-alert/error-alert';
import { MarcaBarraComponent } from '../../shared/ui/marca-barra/marca-barra';
import { PageComponent } from '../../shared/ui/page/page';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

const ETIQUETA_MODO: Record<ModoApp, string> = {
  CLIENTE: 'Cliente',
  TECNICO: 'Técnico',
  PROVEEDOR: 'Proveedor',
};

type PerfilSolicitable = 'CLIENTE' | 'TECNICO';
type EstadoSolicitud = 'inicial' | 'enviando' | 'exito' | 'duplicado' | 'error';

/**
 * A3 — Mi cuenta (Stitch). Concentra la identidad de la sesión, el selector de
 * modo (B15), el pedido de perfiles y el cierre de sesión.
 *
 * El selector muestra SIEMPRE los tres modos: los que la cuenta no tiene quedan
 * deshabilitados con la explicación, en vez de esconderse sin contexto. Según la
 * regla del backend, solo quien se registró como técnico puede adoptar un perfil
 * por su cuenta; los demás lo piden al administrador desde el formulario.
 *
 * Organización: el mismo `<cd-page>` de las otras pantallas principales. El
 * título vive en la cabecera y las secciones siguen el orden
 * identidad → modo → solicitud → cerrar sesión. No hay CTA de pie propio: las
 * acciones siguen junto a su sección, sin inventar un footer nuevo.
 */
@Component({
  selector: 'app-mobile-cuenta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonList,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToolbar,
    PageComponent,
    SkeletonComponent,
    ErrorAlertComponent,
    MarcaBarraComponent,
  ],
  template: `
    <cd-page>
      <ion-header class="cd-header" cdHeader>
        <ion-toolbar>
          <cd-marca pantalla="Mi cuenta" chip="Verificado" chipTestId="cuenta-verificado" />
        </ion-toolbar>
      </ion-header>

      <section class="cd-card cd-cuenta__identidad">
        <span class="cd-cuenta__avatar" aria-hidden="true">{{ inicial() }}</span>
        <div class="cd-cuenta__datos">
          <h2 class="cd-cuenta__nombre" data-testid="cuenta-nombre">{{ nombre() }}</h2>
          <p class="cd-cuenta__rol">Cuenta activa · {{ etiqueta(modoActivo()) }}</p>
          <p class="cd-muted" data-testid="cuenta-correo">{{ correo() }}</p>
        </div>
      </section>

      <section class="cd-card cd-modos">
        <p class="cd-eyebrow">Modo de la app</p>
        <p class="cd-muted">Elige con qué perfil quieres usar Cold Day. Puedes cambiarlo cuando quieras.</p>
        <p class="cd-muted cd-modos__conteo" data-testid="cuenta-perfiles-habilitados">
          {{ disponibles().length }} de {{ todos.length }} perfiles habilitados
        </p>
        @if (!puedeAutoActivar()) {
          <p class="cd-muted" data-testid="cuenta-gating">
            Tu cuenta no se registró como técnico. Los perfiles que no tienes los activa el
            administrador cuando envías una solicitud.
          </p>
        }

        @for (modo of todos; track modo) {
          <button
            type="button"
            class="cd-modo"
            [class.cd-modo--activo]="esActual(modo)"
            [disabled]="!disponible(modo)"
            [attr.aria-pressed]="esActual(modo)"
            [attr.data-testid]="'modo-' + modo.toLowerCase()"
            (click)="elegir(modo)"
          >
            <span class="cd-modo__icono" aria-hidden="true">
              <ion-icon [name]="icono(modo)"></ion-icon>
            </span>
            <span class="cd-modo__texto">
              <span class="cd-modo__nombre">{{ etiqueta(modo) }}</span>
              <span class="cd-modo__nota">{{ descripcion(modo) }}</span>
            </span>
            @if (esActual(modo)) {
              <span class="cd-modo__pill">En uso</span>
            } @else if (!disponible(modo)) {
              <span class="cd-modo__pill cd-modo__pill--off" [attr.data-testid]="'modo-bloqueado-' + modo.toLowerCase()">
                {{ puedeAutoActivar() ? 'No disponible' : 'Pídelo al admin' }}
              </span>
            }
          </button>
        }
      </section>

      @if (faltantes().length > 0) {
        <section class="cd-card" data-testid="cuenta-agregar-perfil">
          <p class="cd-eyebrow">Agregar perfil</p>
          <p class="cd-muted">
            El perfil que te falta lo activa el administrador. Pídelo desde acá y te avisamos
            cuando lo revise.
          </p>

          @switch (estadoSolicitud()) {
            @case ('enviando') {
              <cd-skeleton label="Enviando tu solicitud" testId="solicitud-enviando" />
            }
            @case ('exito') {
              <section class="cd-alerta cd-alerta--ok" role="status" data-testid="solicitud-exito">
                <h2 class="cd-alerta__titulo">Solicitud enviada</h2>
                <p class="cd-alerta__texto">
                  Recibimos tu pedido de perfil de {{ etiqueta(perfilSolicitado()!) }}. Te avisaremos
                  cuando el administrador lo revise.
                </p>
              </section>
            }
            @default {
              @if (estadoSolicitud() === 'duplicado') {
                <section class="cd-alerta cd-alerta--aviso" role="status" data-testid="solicitud-duplicada">
                  <h2 class="cd-alerta__titulo">Ya tienes una solicitud abierta</h2>
                  <p class="cd-alerta__texto">
                    Tenemos una solicitud pendiente para este perfil. Espera a que el administrador
                    la revise antes de enviar otra.
                  </p>
                </section>
              } @else if (estadoSolicitud() === 'error') {
                <cd-error-alert
                  titulo="No pudimos enviar tu solicitud"
                  [texto]="mensajeError()"
                  testId="solicitud-error"
                  accionTestId="solicitud-reintentar"
                  (reintentar)="reintentar()"
                />
              }

              @if (perfilSolicitado(); as pedido) {
                <ion-list class="cd-form" data-testid="formulario-perfil">
                  <ion-item>
                    <ion-select
                      label="Perfil que quieres pedir"
                      labelPlacement="stacked"
                      interface="popover"
                      data-testid="perfil-solicitado"
                      [value]="pedido"
                      [attr.aria-invalid]="errorPerfil() ? 'true' : null"
                      [attr.aria-describedby]="errorPerfil() ? 'error-perfil' : null"
                      (ionChange)="cambiarPerfil($any($event).detail.value)"
                    >
                      <ion-select-option value="CLIENTE">Cliente</ion-select-option>
                      <ion-select-option value="TECNICO">Técnico</ion-select-option>
                    </ion-select>
                  </ion-item>
                  @if (errorPerfil(); as error) {
                    <p class="cd-field-error" id="error-perfil" role="alert" data-testid="error-perfil">{{ error }}</p>
                  }
                  <ion-item>
                    <ion-textarea
                      label="¿Por qué quieres este perfil?"
                      labelPlacement="stacked"
                      rows="4"
                      maxlength="1000"
                      data-testid="motivacion"
                      [value]="motivacion()"
                      [attr.aria-invalid]="errorMotivacion() ? 'true' : null"
                      [attr.aria-describedby]="errorMotivacion() ? 'error-motivacion' : null"
                      (ionInput)="cambiarMotivacion($any($event).detail.value)"
                    ></ion-textarea>
                  </ion-item>
                  @if (errorMotivacion(); as error) {
                    <p class="cd-field-error" id="error-motivacion" role="alert" data-testid="error-motivacion">{{ error }}</p>
                  }
                </ion-list>

                <ion-button
                  expand="block"
                  class="cd-cta"
                  data-testid="solicitar-perfil"
                  (click)="enviar()"
                >
                  Enviar solicitud
                </ion-button>
              } @else {
                @for (perfil of perfilesSolicitables(); track perfil) {
                  <button
                    type="button"
                    class="cd-modo"
                    [attr.data-testid]="'agregar-' + perfil.toLowerCase()"
                    (click)="abrirSolicitud(perfil)"
                  >
                    <span class="cd-modo__icono" aria-hidden="true">
                      <ion-icon [name]="icono(perfil)"></ion-icon>
                    </span>
                    <span class="cd-modo__texto">
                      <span class="cd-modo__nombre">Agregar perfil de {{ etiqueta(perfil) }}</span>
                      <span class="cd-modo__nota">El administrador lo activa</span>
                    </span>
                  </button>
                }
                @if (perfilesSolicitables().length === 0) {
                  <p class="cd-muted">
                    Los demás perfiles los activa un administrador; no se piden desde la app.
                  </p>
                }
              }
            }
          }
        </section>
      }

      <ion-button
        expand="block"
        fill="outline"
        color="danger"
        data-testid="salir"
        (click)="salir()"
      >
        <ion-icon slot="start" name="log-out-outline" aria-hidden="true"></ion-icon>
        Cerrar sesión
      </ion-button>
    </cd-page>
  `,
})
export class CuentaPage {
  private readonly auth = inject(AuthService);
  private readonly modos = inject(ModoService);
  private readonly solicitudesApi = inject(SolicitudesPerfilApi);

  protected readonly todos = ORDEN_MODOS;
  protected readonly modoActual = this.modos.modoActual;
  protected readonly disponibles = this.modos.modosDisponibles;

  /** El modo activo siempre existe al entrar a esta pantalla; el fallback evita null. */
  protected readonly modoActivo = computed<ModoApp>(() => this.modoActual() ?? 'CLIENTE');

  protected readonly usuario = this.auth.currentUser;

  /**
   * Rol inicial persistido (`usuario.rol`). `AuthService` lo expone como
   * `userRole`, separado del conjunto de perfiles que hoy tiene la sesión.
   * Es la señal que usa el gate del backend: solo TECNICO adopta perfiles solo.
   */
  protected readonly rolPrimario = this.auth.userRole;
  protected readonly puedeAutoActivar = computed(() => this.rolPrimario() === 'TECNICO');

  protected readonly perfilSolicitado = signal<PerfilSolicitable | null>(null);
  protected readonly motivacion = signal('');
  protected readonly intentoEnvio = signal(false);
  protected readonly estadoSolicitud = signal<EstadoSolicitud>('inicial');
  protected readonly mensajeError = signal('');

  protected readonly errorPerfil = computed(() => {
    if (!this.intentoEnvio()) return null;
    return this.perfilSolicitado() ? null : 'Elige el perfil que quieres pedir.';
  });

  protected readonly errorMotivacion = computed(() => {
    if (!this.intentoEnvio()) return null;
    const valor = this.motivacion().trim();
    if (!valor) return 'Cuéntanos por qué quieres este perfil.';
    if (valor.length < 10) return 'Escribe al menos 10 caracteres para explicar tu solicitud.';
    if (valor.length > 1000) return 'La motivación no puede pasar de 1000 caracteres.';
    return null;
  });

  protected readonly nombre = computed(() => {
    const usuario = this.usuario();
    return usuario?.nombre || usuario?.correo || 'Tu cuenta';
  });

  protected readonly correo = computed(() => this.usuario()?.correo ?? '');

  protected readonly inicial = computed(() => {
    const nombre = this.usuario()?.nombre?.trim();
    return nombre ? nombre.charAt(0).toUpperCase() : '?';
  });

  protected readonly faltantes = computed(() =>
    this.todos.filter((modo) => !this.disponibles().includes(modo)),
  );

  /** Perfiles que esta app sabe pedir al administrador (contrato del formulario). */
  protected readonly perfilesSolicitables = computed(() =>
    this.faltantes().filter(
      (modo): modo is PerfilSolicitable => modo === 'CLIENTE' || modo === 'TECNICO',
    ),
  );

  /**
   * Abre el formulario de solicitud con el perfil ya elegido (Stitch A3: la
   * sección "AGREGAR PERFIL" son filas; la motivación se pide a demanda).
   */
  protected abrirSolicitud(perfil: PerfilSolicitable): void {
    this.perfilSolicitado.set(perfil);
  }

  protected icono(modo: ModoApp): string {
    switch (modo) {
      case 'CLIENTE':
        return 'home-outline';
      case 'TECNICO':
        return 'construct-outline';
      case 'PROVEEDOR':
        return 'cube-outline';
    }
  }

  protected descripcion(modo: ModoApp): string {
    switch (modo) {
      case 'CLIENTE':
        return 'Pide reparaciones y sigue tus órdenes';
      case 'TECNICO':
        return 'Recibe ofertas y ejecuta servicios';
      case 'PROVEEDOR':
        return 'Vende insumos a técnicos certificados';
    }
  }

  protected etiqueta(modo: ModoApp): string {
    return ETIQUETA_MODO[modo];
  }

  protected esActual(modo: ModoApp): boolean {
    return this.modoActual() === modo;
  }

  protected disponible(modo: ModoApp): boolean {
    return this.disponibles().includes(modo);
  }

  protected elegir(modo: ModoApp): void {
    this.modos.cambiarModo(modo);
  }

  /** Normaliza el valor del ion-select antes de guardarlo en el estado del formulario. */
  cambiarPerfil(valor: unknown): void {
    this.perfilSolicitado.set(valor === 'CLIENTE' || valor === 'TECNICO' ? valor : null);
  }

  cambiarMotivacion(valor: unknown): void {
    this.motivacion.set(typeof valor === 'string' ? valor : '');
  }

  /** Valida en el cliente y envía el body exacto del contrato (perfilDeseado). */
  enviar(): void {
    this.intentoEnvio.set(true);
    if (this.errorPerfil() || this.errorMotivacion()) return;

    const perfilDeseado = this.perfilSolicitado();
    if (!perfilDeseado) return;

    this.estadoSolicitud.set('enviando');
    this.mensajeError.set('');
    this.solicitudesApi
      .solicitar({ perfilDeseado, motivacion: this.motivacion().trim() })
      .subscribe({
        next: () => this.estadoSolicitud.set('exito'),
        error: (err: unknown) => {
          if (err instanceof ApiHttpError && err.status === 409) {
            this.estadoSolicitud.set('duplicado');
            return;
          }
          this.mensajeError.set(
            'No pudimos enviar tu solicitud. Revisa la conexión e inténtalo de nuevo.',
          );
          this.estadoSolicitud.set('error');
        },
      });
  }

  reintentar(): void {
    this.enviar();
  }

  protected salir(): void {
    this.auth.logout();
  }
}
