import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ToastService } from '../../core/shared/presentation/toast.service';

@Component({
  selector: 'app-recuperar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar-page.html',
})
export class RecuperarPage {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly paso = signal<1 | 2>(1);
  readonly tokenSimulado = signal<string>('');
  readonly loading = signal<boolean>(false);

  readonly solicitarForm = new FormGroup({
    correo: new FormControl('maria.gomez@gmail.com', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    })
  });

  readonly resetForm = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nuevaPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] })
  });

  onSolicitarToken(): void {
    if (this.solicitarForm.invalid) return;

    this.loading.set(true);
    const correo = this.solicitarForm.getRawValue().correo;

    this.usuariosApi.solicitarRecuperacion(correo).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.tokenSimulado.set(res.tokenSimulado || 'CD-RESET-884920');
        this.resetForm.patchValue({ token: res.tokenSimulado || 'CD-RESET-884920' });
        this.paso.set(2);
        this.toast.info('Código Enviado', 'Usa el código generado en pantalla para restablecer tu clave.');
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo enviar el código de recuperación.');
      }
    });
  }

  onResetPassword(): void {
    if (this.resetForm.invalid) return;

    this.loading.set(true);
    const { token, nuevaPassword } = this.resetForm.getRawValue();

    this.usuariosApi.resetPassword(token, nuevaPassword).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.toast.success('¡Listo!', res.mensaje);
        this.router.navigate(['/login']);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo actualizar la contraseña.');
      }
    });
  }
}
