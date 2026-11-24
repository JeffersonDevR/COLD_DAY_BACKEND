import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSpinner,
} from '@ionic/angular';
import { EMPTY, Observable, catchError, switchMap, tap } from 'rxjs';
import { mensajeErrorAccion } from '@core/alertas/mensaje-error';
import { TokenResponse } from '@core/models/common.models';
import { AuthService } from '@core/service/auth.service';
import { ClientesApi } from '@core/service/clientes-api';
import { ProveedorRegistroService } from '@core/service/proveedor-registro.service';
import { ProveedoresApi } from '@core/service/proveedores-api';
import { TecnicosApi } from '@core/service/tecnicos-api';
import { UsuariosApi } from '@core/service/usuarios-api';
import { MobileToastService } from '../../core/toast.service';
import { ModoService } from '../../modo/modo.service';
import { RolAlta, copyConflictoAlta } from './registro-copy';

interface OpcionRol {
  readonly valor: RolAlta;
  readonly etiqueta: string;
  readonly nota: string;
}

const ROLES: readonly OpcionRol[] = [
  { valor: 'CLIENTE', etiqueta: 'Cliente', nota: 'Necesito un servicio' },
  { valor: 'TECNICO', etiqueta: 'Técnico', nota: 'Presto servicios' },
  { valor: 'PROVEEDOR', etiqueta: 'Proveedor', nota: 'Vendo insumos' },
];

type CampoRegistro = 'nombre' | 'correo' | 'telefono' | 'password';

/** Copy de campo obligatorio: la etiqueta sola no dice qué escribir. */
const REQUERIDO: Record<CampoRegistro, string> = {
  nombre: 'Ingresa tu nombre completo.',
  correo: 'Ingresa tu correo.',
  telefono: 'Ingresa tu teléfono.',
  password: 'Elige una contraseña.',
};

interface FormularioAlta {
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
  aceptaHabeasData: boolean;
}

/**
 * A2 — Registro móvil multi-rol (Cliente / Técnico / Proveedor).
 *
 * Espeja el alta de la web contra los mismos tres endpoints públicos atómicos
 * (`POST /api/clientes`, `/api/tecnicos`, `/api/proveedores`) y encadena el
 * login real que ya usa A1 para dejar la sesión iniciada. No hay campos
 * inventados: el set de cada rol sale de su DTO del backend.
 */
@Component({
  selector: 'app-mobile-registro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonCheckbox,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonSpinner,
  ],
  template: `
    <ion-content class="cd-auth" [fullscreen]="true">
      <main class="cd-auth__inner">
        <div class="cd-auth__bar cd-auth__bar--nav">
          <a class="cd-auth__back" routerLink="/login" aria-label="Volver al ingreso">
            <ion-icon name="arrow-back-outline" aria-hidden="true"></ion-icon>
          </a>
          <h1 class="cd-auth__bar-titulo">Crear cuenta</h1>
          <ion-icon class="cd-auth__shield" name="shield-checkmark-outline" aria-hidden="true"></ion-icon>
        </div>

        <section class="cd-segment" role="group" aria-label="Tipo de cuenta">
          @for (opcion of roles; track opcion.valor) {
            <button
              type="button"
              class="cd-segment__opcion"
              [class.cd-segment__opcion--activa]="rol() === opcion.valor"
              [attr.aria-pressed]="rol() === opcion.valor"
              [attr.data-testid]="'rol-' + opcion.valor.toLowerCase()"
              (click)="cambiarRol(opcion.valor)"
            >
              <span class="cd-segment__titulo">{{ opcion.etiqueta }}</span>
              <span class="cd-segment__nota">{{ opcion.nota }}</span>
            </button>
          }
        </section>

        <form class="cd-auth__form cd-card" [formGroup]="registroForm" (ngSubmit)="enviar()" novalidate>
          <ion-list lines="none" class="cd-form">
            <ion-item>
              <ion-icon slot="start" name="person-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="nombre"
                autocomplete="name"
                label="Nombre completo"
                labelPlacement="stacked"
                data-testid="nombre"
              ></ion-input>
            </ion-item>
            @if (mensajeCampo('nombre'); as error) {
              <p class="cd-field-error" data-testid="error-nombre">{{ error }}</p>
            }

            <ion-item>
              <ion-icon slot="start" name="mail-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="correo"
                type="email"
                inputmode="email"
                autocomplete="email"
                label="Correo"
                labelPlacement="stacked"
                data-testid="correo"
              ></ion-input>
            </ion-item>
            @if (mensajeCampo('correo'); as error) {
              <p class="cd-field-error" data-testid="error-correo">{{ error }}</p>
            }

            <ion-item>
              <ion-icon slot="start" name="call-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="telefono"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                label="Teléfono"
                labelPlacement="stacked"
                data-testid="telefono"
              ></ion-input>
            </ion-item>
            @if (mensajeCampo('telefono'); as error) {
              <p class="cd-field-error" data-testid="error-telefono">{{ error }}</p>
            }

            <ion-item>
              <ion-icon slot="start" name="lock-closed-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="password"
                [type]="verPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                label="Contraseña (mínimo 8)"
                labelPlacement="stacked"
                data-testid="password"
              ></ion-input>
              <ion-button
                slot="end"
                fill="clear"
                type="button"
                class="cd-auth__ojo"
                [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                data-testid="toggle-password"
                (click)="alternarPassword()"
              >
                <ion-icon
                  [name]="verPassword() ? 'eye-off-outline' : 'eye-outline'"
                  aria-hidden="true"
                ></ion-icon>
              </ion-button>
            </ion-item>
            @if (mensajeCampo('password'); as error) {
              <p class="cd-field-error" data-testid="error-password">{{ error }}</p>
            }
          </ion-list>

          <ion-checkbox
            formControlName="aceptaHabeasData"
            labelPlacement="end"
            justify="start"
            class="cd-legal"
            data-testid="habeas"
          >
            Autorizo el tratamiento de mis datos personales según la
            <strong>Ley 1581 de 2012 (Habeas Data)</strong>.
          </ion-checkbox>
          @if (
            registroForm.controls.aceptaHabeasData.touched &&
            registroForm.controls.aceptaHabeasData.invalid
          ) {
            <p class="cd-field-error" data-testid="error-habeas">
              Debes aceptar el tratamiento de datos para continuar.
            </p>
          }

          @if (error(); as mensaje) {
            <p class="cd-auth__error" role="alert" data-testid="error-alta">
              <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
              <span>{{ mensaje }}</span>
            </p>
          }

          <ion-button
            expand="block"
            type="submit"
            class="cd-cta cd-cta--xl"
            data-testid="crear-cuenta"
            [attr.aria-busy]="loading()"
            [disabled]="loading() || registroForm.invalid"
          >
            @if (loading()) {
              <ion-spinner name="dots" aria-hidden="true"></ion-spinner>
              <span class="cd-cta__loading">Creando cuenta…</span>
            } @else {
              Crear cuenta
            }
          </ion-button>
        </form>

        <p class="cd-auth__link">
          ¿Ya tienes cuenta?
          <a routerLink="/login" data-testid="ir-login">Ingresa</a>
        </p>
      </main>
    </ion-content>
  `,
})
export class RegistroPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly proveedorRegistro = inject(ProveedorRegistroService);
  private readonly auth = inject(AuthService);
  private readonly modos = inject(ModoService);
  private readonly toast = inject(MobileToastService);
  private readonly router = inject(Router);

  protected readonly roles = ROLES;

  protected readonly rol = signal<RolAlta>('CLIENTE');
  protected readonly loading = signal(false);
  protected readonly verPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly registroForm = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    telefono: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(7)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    aceptaHabeasData: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  protected cambiarRol(rol: RolAlta): void {
    if (this.rol() === rol || this.loading()) return;
    this.rol.set(rol);
    this.error.set(null);
  }

  protected alternarPassword(): void {
    this.verPassword.update((visible) => !visible);
  }

  protected mensajeCampo(campo: CampoRegistro): string | null {
    const control = this.registroForm.controls[campo];
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return REQUERIDO[campo];
    if (control.hasError('email')) return 'Ese correo no parece válido.';
    if (control.hasError('minlength')) {
      if (campo === 'password') return 'La contraseña necesita al menos 8 caracteres.';
      if (campo === 'telefono') return 'El teléfono necesita al menos 7 números.';
      return 'Usa al menos 3 caracteres.';
    }
    return null;
  }

  protected enviar(): void {
    if (this.loading()) return;
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const datos = this.registroForm.getRawValue();
    const rol = this.rol();

    this.altaConLogin(this.altaDe(rol, datos), datos.correo, datos.password, rol);
  }

  /** Alta pública del rol: un solo endpoint atómico, igual que en la web. */
  private altaDe(rol: RolAlta, datos: FormularioAlta): Observable<unknown> {
    switch (rol) {
      case 'PROVEEDOR':
        return this.proveedoresApi
          .registrar({
            nombre: datos.nombre,
            correo: datos.correo,
            password: datos.password,
            telefono: datos.telefono,
            aceptaHabeasData: datos.aceptaHabeasData,
          })
          .pipe(
            tap((proveedor) =>
              this.proveedorRegistro.guardar({
                id: proveedor.id,
                usuarioId: proveedor.usuarioId,
                razonSocial: proveedor.razonSocial ?? '',
                nit: proveedor.nit ?? '',
                estadoValidacion: proveedor.estadoValidacion ?? 'PENDIENTE',
              }),
            ),
          );
      case 'TECNICO':
        return this.tecnicosApi.registrar({
          nombre: datos.nombre,
          correo: datos.correo,
          password: datos.password,
          telefono: datos.telefono,
          aceptaHabeasData: datos.aceptaHabeasData,
        });
      default:
        return this.clientesApi.registrarCliente({
          nombre: datos.nombre,
          correo: datos.correo,
          password: datos.password,
          telefono: datos.telefono,
          aceptaHabeasData: datos.aceptaHabeasData,
        });
    }
  }

  /** Alta + login real: los endpoints de alta no emiten token de sesión. */
  private altaConLogin(
    alta$: Observable<unknown>,
    correo: string,
    password: string,
    rol: RolAlta,
  ): void {
    alta$
      .pipe(
        catchError((err: unknown) => {
          this.fallarAlta(err, rol);
          return EMPTY;
        }),
        switchMap(() =>
          this.usuariosApi.login(correo, password).pipe(
            catchError(() => {
              // La cuenta ya existe: no se puede reintentar el alta porque
              // respondería 409. Se manda al login con el aviso de éxito.
              this.cuentaCreadaSinSesion();
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe((res) => this.completarAlta(res, correo, rol));
  }

  private completarAlta(res: TokenResponse, correo: string, rol: RolAlta): void {
    this.loading.set(false);
    this.auth.establecerSesionDesdeToken(res, correo);
    void this.toast.success('Cuenta creada', 'Bienvenido a Cold Day. Ya puedes empezar.');
    // El proveedor nace PENDIENTE: sus solicitudes de insumos responderían 403,
    // así que aterriza en su expediente, igual que en la web.
    const destino =
      rol === 'PROVEEDOR' ? '/proveedor/documentos' : (this.modos.homeActual() ?? '/solo-web');
    void this.router.navigateByUrl(destino);
  }

  private cuentaCreadaSinSesion(): void {
    this.loading.set(false);
    void this.toast.success(
      'Cuenta creada',
      'Ingresa con tu correo y tu contraseña para empezar.',
    );
    void this.router.navigateByUrl('/login');
  }

  private fallarAlta(err: unknown, rol: RolAlta): void {
    this.loading.set(false);
    // El 409 no repite el mensaje del backend y su copy depende del rol: cada
    // alta tiene su propio campo único (ver copyConflictoAlta).
    const mensaje = mensajeErrorAccion(err, { 409: copyConflictoAlta(rol) });
    this.error.set(mensaje);
    void this.toast.error('No pudimos crear la cuenta', mensaje);
  }
}
