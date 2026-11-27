import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';

export interface OpcionTipoDocumento {
  valor: string;
  etiqueta: string;
}

/** Lo que el usuario declaró. Fechas `YYYY-MM-DD`; el backend no recibe archivo. */
export interface DeclaracionDocumento {
  tipo: string;
  fechaExpedicion?: string;
  fechaVencimiento?: string;
}

/**
 * Formulario "Declarar documento" compartido por el técnico y el proveedor. Solo
 * cambia lo que cada rol pide: los tipos, si exige fecha de expedición y si el
 * vencimiento es obligatorio. El backend guarda metadatos, no el archivo.
 */
@Component({
  selector: 'cd-documento-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner],
  template: `
    <form [formGroup]="formulario" class="cd-form" (ngSubmit)="enviar()" data-testid="documento-form">
      <ion-select
        formControlName="tipo"
        label="Tipo de documento"
        labelPlacement="stacked"
        interface="popover"
        data-testid="campo-tipo"
      >
        @for (opcion of tipos(); track opcion.valor) {
          <ion-select-option [value]="opcion.valor">{{ opcion.etiqueta }}</ion-select-option>
        }
      </ion-select>

      @if (pideExpedicion()) {
        <ion-input
          type="date"
          formControlName="fechaExpedicion"
          label="Fecha de expedición"
          labelPlacement="stacked"
          data-testid="campo-expedicion"
        ></ion-input>
        @if (falta('fechaExpedicion')) {
          <p class="cd-field-error" role="alert" data-testid="error-expedicion">Indica cuándo se expidió.</p>
        }
      }

      <ion-input
        type="date"
        formControlName="fechaVencimiento"
        [label]="vencimientoObligatorio() ? 'Fecha de vencimiento' : 'Fecha de vencimiento (opcional)'"
        labelPlacement="stacked"
        data-testid="campo-vencimiento"
      ></ion-input>
      @if (falta('fechaVencimiento')) {
        <p class="cd-field-error" role="alert" data-testid="error-vencimiento">Indica cuándo vence.</p>
      }

      <ion-button
        expand="block"
        class="cd-cta"
        type="submit"
        [attr.aria-busy]="guardando()"
        [disabled]="guardando()"
        data-testid="guardar-documento"
      >
        @if (guardando()) {
          <ion-spinner name="dots" aria-hidden="true"></ion-spinner>
          <span class="cd-cta__loading">Guardando…</span>
        } @else {
          Declarar documento
        }
      </ion-button>
    </form>
  `,
})
export class DocumentoFormComponent implements OnInit {
  readonly tipos = input.required<readonly OpcionTipoDocumento[]>();
  readonly pideExpedicion = input(false);
  readonly vencimientoObligatorio = input(false);
  readonly guardando = input(false);

  readonly declarar = output<DeclaracionDocumento>();

  readonly formulario = new FormGroup({
    tipo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fechaExpedicion: new FormControl('', { nonNullable: true }),
    fechaVencimiento: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.formulario.controls.tipo.setValue(this.tipos()[0]?.valor ?? '');
    if (this.pideExpedicion()) {
      this.formulario.controls.fechaExpedicion.addValidators(Validators.required);
    }
    if (this.vencimientoObligatorio()) {
      this.formulario.controls.fechaVencimiento.addValidators(Validators.required);
    }
    this.formulario.updateValueAndValidity();
  }

  protected falta(campo: 'fechaExpedicion' | 'fechaVencimiento'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.hasError('required');
  }

  enviar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valor = this.formulario.getRawValue();
    this.declarar.emit({
      tipo: valor.tipo,
      fechaExpedicion: valor.fechaExpedicion || undefined,
      fechaVencimiento: valor.fechaVencimiento || undefined,
    });
  }
}
