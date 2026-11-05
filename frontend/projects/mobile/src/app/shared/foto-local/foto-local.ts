import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { MobileCameraService } from '../../core/camera-native';
import { MobileToastService } from '../../core/toast.service';

/**
 * Foto local del equipo.
 *
 * Captura y previsualiza sin enviar nada: el backend es metadata-only y el
 * storage de evidencias todavía no existe. La nota de la UI lo dice explícito
 * para que nadie asuma que la foto llegó al técnico/cliente.
 */
@Component({
  selector: 'app-foto-local',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, IonSpinner],
  template: `
    <div class="cd-foto">
      <div class="cd-foto__cabecera">
        <span class="cd-foto__titulo">Foto del equipo (opcional)</span>
        @if (foto()) {
          <ion-button fill="clear" size="small" color="danger" (click)="quitar()">
            <ion-icon slot="start" name="trash-outline" aria-hidden="true"></ion-icon>
            Quitar
          </ion-button>
        }
      </div>

      @if (foto(); as imagen) {
        <img class="cd-foto__preview" [src]="imagen" alt="Foto del equipo capturada" data-testid="foto-preview" />
      } @else {
        <ion-button
          fill="outline"
          size="small"
          [disabled]="sacando()"
          (click)="capturar()"
          data-testid="sacar-foto"
        >
          @if (sacando()) {
            <ion-spinner name="dots"></ion-spinner>
          } @else {
            <ion-icon slot="start" name="camera-outline" aria-hidden="true"></ion-icon>
            {{ camera.esNativo() ? 'Sacar foto' : 'Elegir foto' }}
          }
        </ion-button>
      }

      <p class="cd-foto__nota" data-testid="foto-nota">
        La foto queda solo en este dispositivo. El envío de evidencias todavía no está habilitado.
      </p>

      <input
        #archivo
        type="file"
        accept="image/*"
        capture="environment"
        class="cd-foto__input"
        (change)="desdeArchivo($event)"
      />
    </div>
  `,
})
export class FotoLocalComponent {
  protected readonly camera = inject(MobileCameraService);
  private readonly toast = inject(MobileToastService);

  @ViewChild('archivo') private archivo?: ElementRef<HTMLInputElement>;

  protected readonly foto = signal<string | null>(null);
  protected readonly sacando = signal(false);

  protected async capturar(): Promise<void> {
    if (!this.camera.esNativo()) {
      this.archivo?.nativeElement.click();
      return;
    }

    this.sacando.set(true);
    try {
      const dataUrl = await this.camera.tomarFoto();
      if (dataUrl) this.foto.set(dataUrl);
    } catch (err) {
      void this.toast.error(
        'No se pudo abrir la cámara',
        err instanceof Error ? err.message : 'Intentá de nuevo.',
      );
    } finally {
      this.sacando.set(false);
    }
  }

  protected desdeArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.foto.set(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
    input.value = '';
  }

  protected quitar(): void {
    this.foto.set(null);
  }
}
