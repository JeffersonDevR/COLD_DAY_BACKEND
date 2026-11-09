import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';
import { EMPTY, Observable, catchError, switchMap, tap } from 'rxjs';
import { mensajeErrorAccion } from '@core/alertas/mensaje-error';
import { CategoriaServicio, TipoCliente, TokenResponse } from '@core/models/common.models';
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

/**
 * `TecnicoApiRequest.categoriasServicio` es `@NotEmpty` en el backend, así que
 * la especialidad NO es opcional: el default espeja el de la web (dos líneas
 * preseleccionadas) y el formulario exige al menos una.
 */
const ESPECIALIDADES: readonly { valor: CategoriaServicio; etiqueta: string }[] = [
  { valor: 'AIRE_ACONDICIONADO', etiqueta: 'Aire acondicionado' },
  { valor: 'REFRIGERACION', etiqueta: 'Refrigeración' },
  { valor: 'ELECTRICIDAD', etiqueta: 'Electricidad' },
  { valor: 'LAVADORAS', etiqueta: 'Lavadoras' },
  { valor: 'CAMARAS_VIGILANCIA', etiqueta: 'Cámaras de vigilancia' },
];

const ESPECIALIDADES_POR_DEFECTO: readonly CategoriaServicio[] = [
  'AIRE_ACONDICIONADO',
  'REFRIGERACION',
];

type CampoRegistro =
  | 'nombre'
  | 'correo'
  | 'telefono'
  | 'password'
  | 'confirmacion'
  | 'calle'
  | 'ciudad'
  | 'numeroIdentificacion'
  | 'razonSocial'
  | 'nit';

/** Copy de campo obligatorio: la etiqueta sola no dice qué escribir. */
const REQUERIDO: Record<CampoRegistro, string> = {
  nombre: 'Ingresá tu nombre completo.',
  correo: 'Ingresá tu correo.',
  telefono: 'Ingresá tu teléfono.',
  password: 'Elegí una contraseña.',
  confirmacion: 'Repetí la contraseña.',
  calle: 'Ingresá la calle de tu dirección.',
  ciudad: 'Ingresá tu ciudad.',
  numeroIdentificacion: 'Ingresá tu número de identificación.',
  razonSocial: 'Ingresá la razón social de tu empresa.',
  nit: 'Ingresá el NIT de tu empresa.',
};

/** Confirmación: debe coincidir con `password` en todo momento. */
const contrasenasDistintas: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.parent?.get('password')?.value;
  return control.value === password ? null : { contrasenasDistintas: true };
};

interface FormularioAlta {
  nombre: string;
  correo: string;
  telefono: string;
  password: string;
  confirmacion: string;
  tipoCliente: TipoCliente;
  calle: string;
  ciudad: string;
  numeroIdentificacion: string;
  razonSocial: string;
  nit: string;
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
    IonSelect,
    IonSelectOption,
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

        <div class="cd-auth__ops">
          <span class="cd-auth__ops-marca">Cold Day · Ops CO</span>
          <span class="cd-auth__ops-fase">Fase registro</span>
        </div>

        <header class="cd-auth__brand">
          <svg class="cd-logo" viewBox="0 0 48 48" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M24 7v34M9.3 15.5l29.4 17M9.3 32.5l29.4-17" />
              <path d="M24 7l-3.5 3.5M24 7l3.5 3.5M24 41l-3.5-3.5M24 41l3.5-3.5" />
              <path d="M9.3 15.5l1.2 4.7M9.3 15.5l4.8-.8M38.7 32.5l-1.2-4.7M38.7 32.5l-4.8.8" />
              <path d="M9.3 32.5l4.8.8M9.3 32.5l1.2-4.7M38.7 15.5l-4.8-.8M38.7 15.5l-1.2 4.7" />
            </g>
          </svg>
          <h1 class="cd-wordmark">Cold Day</h1>
          <p class="cd-tagline">Creá tu cuenta y operá en frío, en tiempo real.</p>
        </header>

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
                label="Contraseña (mínimo 6 caracteres)"
                labelPlacement="stacked"
                data-testid="password"
              ></ion-input>
            </ion-item>
            @if (mensajeCampo('password'); as error) {
              <p class="cd-field-error" data-testid="error-password">{{ error }}</p>
            }

            <ion-item>
              <ion-icon slot="start" name="lock-closed-outline" aria-hidden="true"></ion-icon>
              <ion-input
                formControlName="confirmacion"
                [type]="verPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                label="Repetí la contraseña"
                labelPlacement="stacked"
                data-testid="confirmacion"
              ></ion-input>
            </ion-item>
            @if (mensajeCampo('confirmacion'); as error) {
              <p class="cd-field-error" data-testid="error-confirmacion">{{ error }}</p>
            }
          </ion-list>

          <ion-button
            fill="clear"
            type="button"
            class="cd-auth__ojo"
            [attr.aria-label]="verPassword() ? 'Ocultar contraseñas' : 'Mostrar contraseñas'"
            data-testid="toggle-password"
            (click)="alternarPassword()"
          >
            <ion-icon
              [name]="verPassword() ? 'eye-off-outline' : 'eye-outline'"
              aria-hidden="true"
            ></ion-icon>
          </ion-button>

          @if (rol() === 'CLIENTE') {
            <fieldset class="cd-section" data-testid="campos-cliente">
              <legend class="cd-section__titulo">Tus datos de servicio</legend>
              <ion-list lines="none" class="cd-form">
                <ion-item>
                  <ion-select
                    formControlName="tipoCliente"
                    label="Tipo de cliente"
                    labelPlacement="stacked"
                    interface="popover"
                    data-testid="tipo-cliente"
                  >
                    <ion-select-option value="B2C">Persona (B2C)</ion-select-option>
                    <ion-select-option value="B2B">Empresa (B2B)</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item>
                  <ion-input
                    formControlName="calle"
                    autocomplete="address-line1"
                    label="Calle y número"
                    labelPlacement="stacked"
                    data-testid="calle"
                  ></ion-input>
                </ion-item>
                @if (mensajeCampo('calle'); as error) {
                  <p class="cd-field-error" data-testid="error-calle">{{ error }}</p>
                }

                <ion-item>
                  <ion-input
                    formControlName="ciudad"
                    autocomplete="address-level2"
                    label="Ciudad"
                    labelPlacement="stacked"
                    data-testid="ciudad"
                  ></ion-input>
                </ion-item>
                @if (mensajeCampo('ciudad'); as error) {
                  <p class="cd-field-error" data-testid="error-ciudad">{{ error }}</p>
                }
              </ion-list>
              <p class="cd-ayuda">Usamos esta dirección para asignarte técnicos cerca tuyo.</p>
            </fieldset>
          }

          @if (rol() === 'TECNICO') {
            <fieldset class="cd-section" data-testid="campos-tecnico">
              <legend class="cd-section__titulo">Perfil técnico</legend>
              <ion-list lines="none" class="cd-form">
                <ion-item>
                  <ion-input
                    formControlName="numeroIdentificacion"
                    label="Número de identificación"
                    labelPlacement="stacked"
                    data-testid="numero-identificacion"
                  ></ion-input>
                </ion-item>
                @if (mensajeCampo('numeroIdentificacion'); as error) {
                  <p class="cd-field-error" data-testid="error-identificacion">{{ error }}</p>
                }
              </ion-list>

              <p class="cd-ayuda">Especialidades (elegí al menos una)</p>
              <div class="cd-chips">
                @for (esp of especialidadesDisponibles; track esp.valor) {
                  <button
                    type="button"
                    class="cd-chip"
                    [class.cd-chip--activo]="tieneEspecialidad(esp.valor)"
                    [attr.aria-pressed]="tieneEspecialidad(esp.valor)"
                    [attr.data-testid]="'especialidad-' + esp.valor.toLowerCase()"
                    (click)="alternarEspecialidad(esp.valor)"
                  >
                    {{ esp.etiqueta }}
                  </button>
                }
              </div>
              @if (!especialidadesValidas()) {
                <p class="cd-field-error" data-testid="error-especialidades">
                  Elegí al menos una especialidad.
                </p>
              }

              <p class="cd-ayuda">
                Tu cédula y tus certificaciones pasan por validación administrativa antes de
                operar. Podés cargarlas después de crear la cuenta.
              </p>
            </fieldset>
          }

          @if (rol() === 'PROVEEDOR') {
            <fieldset class="cd-section" data-testid="campos-proveedor">
              <legend class="cd-section__titulo">Datos comerciales</legend>
              <ion-list lines="none" class="cd-form">
                <ion-item>
                  <ion-input
                    formControlName="razonSocial"
                    autocomplete="organization"
                    label="Razón social"
                    labelPlacement="stacked"
                    data-testid="razon-social"
                  ></ion-input>
                </ion-item>
                @if (mensajeCampo('razonSocial'); as error) {
                  <p class="cd-field-error" data-testid="error-razon-social">{{ error }}</p>
                }

                <ion-item>
                  <ion-input
                    formControlName="nit"
                    label="NIT"
                    labelPlacement="stacked"
                    data-testid="nit"
                  ></ion-input>
                </ion-item>
                @if (mensajeCampo('nit'); as error) {
                  <p class="cd-field-error" data-testid="error-nit">{{ error }}</p>
                }
              </ion-list>
              <p class="cd-ayuda">
                Tu cuenta nace en estado PENDIENTE: podés cargar documentos, pero no aceptar
                pedidos de insumos hasta que un administrador la valide.
              </p>
            </fieldset>
          }

          <ion-checkbox
            formControlName="aceptaHabeasData"
            labelPlacement="end"
            justify="start"
            class="cd-legal"
            data-testid="habeas"
          >
            Autorizo el tratamiento de mis datos personales de acuerdo con la
            <strong>Ley 1581 de 2012 (Habeas Data)</strong> de Colombia y la política de
            privacidad de COLD DAY S.A.S. para fines operativos de intermediación técnica y
            geolocalización.
          </ion-checkbox>
          @if (
            registroForm.controls.aceptaHabeasData.touched &&
            registroForm.controls.aceptaHabeasData.invalid
          ) {
            <p class="cd-field-error" data-testid="error-habeas">
              Debés aceptar el tratamiento de datos para continuar.
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
            [disabled]="loading() || registroForm.invalid || !especialidadesValidas()"
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
          ¿Ya tenés cuenta?
          <a routerLink="/login" data-testid="ir-login">Ingresá</a>
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
  protected readonly especialidadesDisponibles = ESPECIALIDADES;

  protected readonly rol = signal<RolAlta>('CLIENTE');
  protected readonly especialidades = signal<CategoriaServicio[]>([
    ...ESPECIALIDADES_POR_DEFECTO,
  ]);
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
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, contrasenasDistintas],
    }),
    tipoCliente: new FormControl<TipoCliente>('B2C', { nonNullable: true }),
    calle: new FormControl('', { nonNullable: true }),
    ciudad: new FormControl('', { nonNullable: true }),
    numeroIdentificacion: new FormControl('', { nonNullable: true }),
    razonSocial: new FormControl('', { nonNullable: true }),
    nit: new FormControl('', { nonNullable: true }),
    aceptaHabeasData: new FormControl(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  constructor() {
    this.aplicarRequisitos('CLIENTE');
    // La confirmación depende de la contraseña: al cambiarla se revalida.
    this.registroForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.registroForm.controls.confirmacion.updateValueAndValidity({ emitEvent: false }),
      );
  }

  protected cambiarRol(rol: RolAlta): void {
    if (this.rol() === rol || this.loading()) return;
    this.rol.set(rol);
    this.error.set(null);
    this.aplicarRequisitos(rol);
    for (const campo of [
      'calle',
      'ciudad',
      'numeroIdentificacion',
      'razonSocial',
      'nit',
    ] as const) {
      this.registroForm.controls[campo].markAsUntouched();
    }
  }

  protected alternarPassword(): void {
    this.verPassword.update((visible) => !visible);
  }

  protected tieneEspecialidad(categoria: CategoriaServicio): boolean {
    return this.especialidades().includes(categoria);
  }

  protected alternarEspecialidad(categoria: CategoriaServicio): void {
    const actuales = this.especialidades();
    this.especialidades.set(
      actuales.includes(categoria)
        ? actuales.filter((item) => item !== categoria)
        : [...actuales, categoria],
    );
  }

  protected especialidadesValidas(): boolean {
    return this.rol() !== 'TECNICO' || this.especialidades().length > 0;
  }

  protected mensajeCampo(campo: CampoRegistro): string | null {
    const control = this.registroForm.controls[campo];
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return REQUERIDO[campo];
    if (control.hasError('email')) return 'Ese correo no parece válido.';
    if (control.hasError('contrasenasDistintas')) return 'Las contraseñas no coinciden.';
    if (control.hasError('minlength')) {
      if (campo === 'password') return 'La contraseña necesita al menos 6 caracteres.';
      if (campo === 'telefono') return 'El teléfono necesita al menos 7 números.';
      return 'Usá al menos 3 caracteres.';
    }
    return null;
  }

  protected enviar(): void {
    if (this.loading()) return;
    if (this.registroForm.invalid || !this.especialidadesValidas()) {
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
            razonSocial: datos.razonSocial,
            nit: datos.nit,
            aceptaHabeasData: datos.aceptaHabeasData,
          })
          .pipe(
            tap((proveedor) =>
              this.proveedorRegistro.guardar({
                id: proveedor.id,
                usuarioId: proveedor.usuarioId,
                razonSocial: proveedor.razonSocial,
                nit: proveedor.nit,
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
          numeroIdentificacion: datos.numeroIdentificacion,
          categoriasServicio: this.especialidades(),
          certificaciones: [],
          aceptaHabeasData: datos.aceptaHabeasData,
        });
      default:
        return this.clientesApi.registrarCliente({
          nombre: datos.nombre,
          correo: datos.correo,
          password: datos.password,
          telefono: datos.telefono,
          tipoCliente: datos.tipoCliente,
          calle: datos.calle,
          ciudad: datos.ciudad,
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
    void this.toast.success('Cuenta creada', 'Bienvenido a Cold Day. Ya podés empezar.');
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
      'Ingresá con tu correo y tu contraseña para empezar.',
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

  private aplicarRequisitos(rol: RolAlta): void {
    this.exigir('calle', rol === 'CLIENTE');
    this.exigir('ciudad', rol === 'CLIENTE');
    this.exigir('numeroIdentificacion', rol === 'TECNICO');
    this.exigir('razonSocial', rol === 'PROVEEDOR');
    this.exigir('nit', rol === 'PROVEEDOR');
  }

  private exigir(
    campo: 'calle' | 'ciudad' | 'numeroIdentificacion' | 'razonSocial' | 'nit',
    requerido: boolean,
  ): void {
    const control = this.registroForm.controls[campo];
    control.setValidators(requerido ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }
}
