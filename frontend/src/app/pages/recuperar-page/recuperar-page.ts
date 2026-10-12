import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosApi } from '../../core/service/usuarios-api';
import { ToastService } from '../../core/alertas/toast.service';

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
  /**
   * Código de demostración. SÓLO se rellena con la respuesta del modo mock; el
   * backend real nunca lo entrega (el token viaja por correo), por eso la UI no
   * debe prefigurar ni mostrar ningún token fabricado.
   */
  readonly tokenSimulado = signal<string>('');
  readonly modoDemo = computed(() => this.tokenSimulado().length > 0);
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
        const tokenDemo = res.tokenSimulado ?? '';
        this.tokenSimulado.set(tokenDemo);
        this.resetForm.patchValue({ token: tokenDemo });
        this.paso.set(2);
        if (tokenDemo) {
          this.toast.info('Código de demo', 'Usa el código mostrado en pantalla para restablecer tu clave.');
        } else {
          this.toast.info('Revisa tu correo', 'Te enviamos las instrucciones y el código de restablecimiento.');
        }
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
