import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/service/auth.service';
import { TecnicosApi } from '../../core/service/tecnicos-api';
import { ClientesApi } from '../../core/service/clientes-api';
import { ToastService } from '../../core/alertas/toast.service';
import { avisarErrorAccion } from '../../core/alertas/mensaje-error';
import { CategoriaServicio, TipoCliente } from '../../core/models/common.models';
import { CertificacionApi } from '../../core/models/backend.dto';
import { CIUDAD_OPERACION } from '../../core/service/mapa-config.service';
import { SolicitudDraftService } from '../../core/service/solicitud-draft.service';

/** Perfiles que un usuario ya autenticado puede adquirir como segundo rol. */
export type TipoPerfilAdquirible = 'TECNICO' | 'CLIENTE';

/**
 * Convierte el textarea (una certificación por línea) al contrato del backend.
 * El backend acepta `Set<Certificacion>`; acá solo se declara el nombre, el
 * resto queda `null` (no se fabrican fechas).
 */
export function parseCertificaciones(texto: string): CertificacionApi[] {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .map((nombre) => ({ nombre, institucion: null, fechaObtencion: null, fechaVencimiento: null }));
}

/**
 * CTA de adquisición del segundo perfil (Cliente o Técnico). Solo ofrece los
 * perfiles que al usuario AÚN le faltan (`auth.userRoles()`). Al crear el perfil
 * el backend sube `tokenVersion` y devuelve el JWT de reemplazo en la misma
 * respuesta: la pantalla lo adopta, vuelve al `returnUrl` (o al panel del perfil
 * recién creado) y nunca cierra la sesión. Solo si la respuesta no trae `token`
 * (backend legado) se conserva el aviso de re-login.
 */
@Component({
  selector: 'app-agregar-perfil-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './agregar-perfil-page.html',
})
export class AgregarPerfilPage {
  private readonly auth = inject(AuthService);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly draftService = inject(SolicitudDraftService);

  /** Pantalla que pidió el alta del perfil; `null` cae al panel del perfil creado. */
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly categorias: CategoriaServicio[] = [
    'CAMARAS_VIGILANCIA',
    'REFRIGERACION',
    'AIRE_ACONDICIONADO',
    'LAVADORAS',
    'ELECTRICIDAD',
  ];
  readonly tiposCliente: TipoCliente[] = ['B2C', 'B2B'];

  readonly puedeSerTecnico = computed(() => !this.auth.userRoles().has('TECNICO'));
  readonly puedeSerCliente = computed(() => !this.auth.userRoles().has('CLIENTE'));

  readonly seleccion = signal<TipoPerfilAdquirible | null>(null);
  readonly categoriasSeleccionadas = signal<CategoriaServicio[]>([]);
  readonly cargando = signal(false);
  readonly sesionActualizada = signal(false);

  readonly formTecnico = new FormGroup({
    numeroIdentificacion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5)],
    }),
    certificaciones: new FormControl('', { nonNullable: true }),
  });

  readonly formCliente = new FormGroup({
    tipoCliente: new FormControl<TipoCliente>('B2C', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    calle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ciudad: new FormControl(CIUDAD_OPERACION, { nonNullable: true, validators: [Validators.required] }),
    barrio: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    // Si el alta nace de una solicitud en curso, la dirección ya está tipeada.
    const draft = this.draftService.leer();
    if (draft?.direccion) {
      this.formCliente.patchValue({ calle: draft.direccion });
    }
  }

  elegir(tipo: TipoPerfilAdquirible): void {
    this.seleccion.set(tipo);
  }

  toggleCategoria(categoria: CategoriaServicio): void {
    const actuales = this.categoriasSeleccionadas();
    this.categoriasSeleccionadas.set(
      actuales.includes(categoria)
        ? actuales.filter((c) => c !== categoria)
        : [...actuales, categoria],
    );
  }

  tieneCategoria(categoria: CategoriaServicio): boolean {
    return this.categoriasSeleccionadas().includes(categoria);
  }

  enviarTecnico(): void {
    if (this.formTecnico.invalid || this.categoriasSeleccionadas().length === 0) {
      this.toast.error('Faltan datos', 'Ingresa tu identificación y al menos una especialidad.');
      return;
    }
    const valor = this.formTecnico.getRawValue();
    this.cargando.set(true);
    this.tecnicosApi
      .crearMiPerfil({
        numeroIdentificacion: valor.numeroIdentificacion.trim(),
        categoriasServicio: this.categoriasSeleccionadas(),
        certificaciones: parseCertificaciones(valor.certificaciones),
      })
      .subscribe({
        next: (perfil) => this.completarAdquisicion('TECNICO', perfil.token),
        error: (err: Error) => this.errorAdquirir(err),
      });
  }

  enviarCliente(): void {
    if (this.formCliente.invalid) {
      this.toast.error('Faltan datos', 'Completa tu tipo de cliente y la dirección.');
      return;
    }
    const valor = this.formCliente.getRawValue();
    const ubicacion = this.draftService.leer()?.coordenadas ?? undefined;
    this.cargando.set(true);
    this.clientesApi
      .crearMiPerfil({
        tipoCliente: valor.tipoCliente,
        calle: valor.calle.trim(),
        ciudad: valor.ciudad.trim(),
        barrio: valor.barrio.trim() || undefined,
        ...(ubicacion ? { ubicacion } : {}),
      })
      .subscribe({
        next: (perfil) => this.completarAdquisicion('CLIENTE', perfil.token),
        error: (err: Error) => this.errorAdquirir(err),
      });
  }

  /**
   * Cierra el alta: con token adopta la sesión nueva y vuelve a la pantalla de
   * origen (o al panel del perfil adquirido) sin logout. Sin token —backend
   * legado— el JWT en vuelo quedó revocado y hay que reautenticarse.
   */
  private completarAdquisicion(tipo: TipoPerfilAdquirible, token?: string): void {
    this.cargando.set(false);
    if (!token) {
      this.sesionActualizada.set(true);
      return;
    }
    this.auth.adoptarToken(token);
    this.router.navigateByUrl(this.returnUrl ?? this.auth.getDashboardRouteForRole(tipo));
  }

  private errorAdquirir(err: Error): void {
    this.cargando.set(false);
    // El 409 real es perfil ya adquirido (backend: "El usuario ya tiene un
    // perfil de cliente: <id>"): la copy no repite ids de dominio.
    avisarErrorAccion(this.toast, 'No se pudo crear el perfil', err, {
      409: 'Ya tenés ese perfil. Volvé al panel y actualizá la página si es necesario.',
    });
  }

  /** Cierra la sesión revocada y aterriza en el login para reautenticarse. */
  irAIniciarSesion(): void {
    this.auth.logout();
  }
}
