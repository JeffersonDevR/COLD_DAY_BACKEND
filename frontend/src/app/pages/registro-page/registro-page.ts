import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ClientesApi } from '../../modules/clientes/infrastructure/clientes-api';
import { TecnicosApi } from '../../modules/tecnicos/infrastructure/tecnicos-api';
import { ProveedoresApi } from '../../modules/proveedores/infrastructure/proveedores-api';
import { ProveedorRegistroService } from '../../modules/proveedores/infrastructure/proveedor-registro.service';
import { ApiConfig } from '../../core/shared/infrastructure/api/api.config';
import { AuthService } from '../../core/shared/infrastructure/auth/auth.service';
import { ToastService } from '../../core/shared/presentation/toast.service';
import { Rol, CategoriaServicio, TokenResponse } from '../../core/models/common.models';

@Component({
  selector: 'app-registro-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro-page.html',
})
export class RegistroPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly tecnicosApi = inject(TecnicosApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly proveedorRegistro = inject(ProveedorRegistroService);
  private readonly apiConfig = inject(ApiConfig);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly selectedRol = signal<Rol>('CLIENTE');
  readonly especialidades = signal<CategoriaServicio[]>(['AIRE_ACONDICIONADO', 'REFRIGERACION']);
  readonly loading = signal<boolean>(false);

  readonly registroForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(7)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    numeroIdentificacion: new FormControl('', { nonNullable: true }),
    razonSocial: new FormControl('', { nonNullable: true }),
    nit: new FormControl('', { nonNullable: true }),
    aceptaHabeasData: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
  });

  toggleEspecialidad(cat: CategoriaServicio): void {
    const list = this.especialidades();
    if (list.includes(cat)) {
      this.especialidades.set(list.filter(c => c !== cat));
    } else {
      this.especialidades.set([...list, cat]);
    }
  }

  hasEspecialidad(cat: CategoriaServicio): boolean {
    return this.especialidades().includes(cat);
  }

  onSubmit(): void {
    if (this.registroForm.invalid) return;

    const formVal = this.registroForm.getRawValue();
    const rol = this.selectedRol();

    if (rol === 'TECNICO' && !formVal.numeroIdentificacion.trim()) {
      this.toast.error('Falta la cédula', 'Ingresa tu número de identificación para registrarte como técnico.');
      return;
    }

    // El proveedor declara su identidad comercial: sin razón social o sin NIT el
    // backend responde 400, así que se corta aquí y no se gastan dos round trips.
    if (rol === 'PROVEEDOR' && (!formVal.razonSocial.trim() || !formVal.nit.trim())) {
      this.toast.error('Faltan datos comerciales', 'Ingresa la razón social y el NIT de tu empresa.');
      return;
    }

    this.loading.set(true);

    // PROVEEDOR: alta atómica en /api/proveedores (Usuario rol PROVEEDOR + perfil).
    // Va antes del atajo de mock porque el mock también tiene que crear el
    // proveedor, no solo un usuario suelto.
    if (rol === 'PROVEEDOR') {
      this.proveedoresApi.registrar({
        nombre: formVal.nombre,
        correo: formVal.correo,
        password: formVal.password,
        telefono: formVal.telefono,
        razonSocial: formVal.razonSocial.trim(),
        nit: formVal.nit.trim(),
        aceptaHabeasData: formVal.aceptaHabeasData,
      }).subscribe({
        next: (proveedor) => {
          this.proveedorRegistro.guardar({
            id: proveedor.id,
            usuarioId: proveedor.usuarioId,
            razonSocial: proveedor.razonSocial,
            nit: proveedor.nit,
            estadoValidacion: proveedor.estadoValidacion ?? 'PENDIENTE',
          });
          this.usuariosApi.login(formVal.correo, formVal.password).subscribe({
            next: (res) => this.completarAlta(res, formVal.correo),
            error: (err: Error) => this.errorAlta(err),
          });
        },
        error: (err: Error) => this.errorAlta(err),
      });
      return;
    }

    // Modo mock: alta en memoria + sesión simulada (comportamiento previo).
    if (this.apiConfig.useMocks()) {
      this.usuariosApi.registro({
        nombre: formVal.nombre,
        correo: formVal.correo,
        telefono: formVal.telefono,
        password: formVal.password,
        rol,
        aceptaHabeasData: formVal.aceptaHabeasData
      }).subscribe({
        next: (user) => {
          this.loading.set(false);
          this.authService.setCurrentUser(user);
          this.toast.success('Cuenta Creada Exitosamente', `Bienvenido a COLD DAY, ${user.nombre}`);
          this.router.navigate([this.authService.getDashboardRouteForRole(user.rol)]);
        },
        error: (err: Error) => this.errorAlta(err),
      });
      return;
    }

    // TÉCNICO: /api/tecnicos crea Usuario + perfil en una sola llamada (endpoint público).
    if (rol === 'TECNICO') {
      this.altaConLogin(
        this.tecnicosApi.registrar({
          nombre: formVal.nombre,
          correo: formVal.correo,
          password: formVal.password,
          telefono: formVal.telefono,
          numeroIdentificacion: formVal.numeroIdentificacion,
          categoriasServicio: this.especialidades(),
          certificaciones: [],
          aceptaHabeasData: formVal.aceptaHabeasData,
        }),
        formVal.correo,
        formVal.password,
      );
      return;
    }

    // CLIENTE: alta atómica en /api/clientes (Usuario + perfil) → login real.
    // Ya no se hacen dos pasos ni se usa el token mock.
    this.altaConLogin(
      this.clientesApi.registrarCliente({
        nombre: formVal.nombre,
        correo: formVal.correo,
        password: formVal.password,
        telefono: formVal.telefono,
        tipoCliente: 'B2C',
        calle: 'Por definir',
        ciudad: 'Cúcuta',
        ubicacion: { latitud: 7.8939, longitud: -72.5078 },
        aceptaHabeasData: formVal.aceptaHabeasData,
      }),
      formVal.correo,
      formVal.password,
    );
  }

  /** Crea el usuario/perfil y encadena el login real para iniciar sesión. */
  private altaConLogin(fuente$: Observable<unknown>, correo: string, password: string): void {
    fuente$
      .pipe(switchMap(() => this.usuariosApi.login(correo, password)))
      .subscribe({
        next: (res) => this.completarAlta(res, correo),
        error: (err: Error) => this.errorAlta(err),
      });
  }

  private completarAlta(res: TokenResponse, correo: string): void {
    this.loading.set(false);
    const usuario = this.authService.establecerSesionDesdeToken(res, correo);
    this.toast.success('Cuenta Creada Exitosamente', `Bienvenido a COLD DAY, ${usuario.nombre}`);
    // El proveedor aterriza en su expediente, no en el listado de solicitudes:
    // recién registrado está PENDIENTE y esas solicitudes le responderían 403.
    const destino = usuario.rol === 'PROVEEDOR' ? '/proveedor/documentos' : this.authService.getDashboardRouteForRole(usuario.rol);
    this.router.navigate([destino]);
  }

  private errorAlta(err: Error): void {
    this.loading.set(false);
    this.toast.error('Error al registrar', err.message || 'Por favor intenta nuevamente.');
  }
}
