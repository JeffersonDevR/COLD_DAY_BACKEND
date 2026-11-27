import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  VigenciaDocumento,
  etiquetaVigencia,
  vigenciaDocumento,
} from '@core/service/documentos-vigencia';

/** Un documento listo para pintar: lo arman la pantalla del técnico y la del proveedor. */
export interface DocumentoVista {
  id: string;
  titulo: string;
  /** `YYYY-MM-DD`. */
  expedicion?: string;
  /** `YYYY-MM-DD`. Con él se calcula la vigencia (vencido, por vencer, vigente). */
  vencimiento?: string;
  /** Estado de validación, si el backend lo da por documento. */
  estadoTexto?: string;
  estadoTono?: 'ok' | 'curso' | 'espera' | 'cerrada';
  observaciones?: string;
}

interface FilaDocumento extends DocumentoVista {
  vigencia: VigenciaDocumento;
}

const TONO_VIGENCIA: Record<VigenciaDocumento, string> = {
  VENCIDO: 'cerrada',
  POR_VENCER: 'espera',
  VIGENTE: 'ok',
  SIN_VENCIMIENTO: 'curso',
};

/** `2030-05-20` → `20 may 2030`. Sin fecha válida devuelve el texto original. */
function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Lista de documentos del expediente, igual para el técnico y para el proveedor:
 * título, fechas legibles, chip de vigencia calculado por la fecha de
 * vencimiento y, si lo hay, el estado de validación con sus observaciones.
 */
@Component({
  selector: 'cd-documentos-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (doc of filas(); track doc.id) {
      <article class="cd-card cd-liq" [attr.data-testid]="'documento-' + doc.id">
        <div class="cd-liq__cabecera">
          <div>
            <p class="cd-ot__codigo">{{ doc.titulo }}</p>
            @if (doc.expedicion) {
              <p class="cd-liq__meta">Expide {{ legible(doc.expedicion) }}</p>
            }
            @if (doc.vencimiento) {
              <p class="cd-liq__meta">Vence {{ legible(doc.vencimiento) }}</p>
            }
          </div>
          <div class="cd-documento__chips">
            @if (doc.vigencia !== 'SIN_VENCIMIENTO') {
              <span
                class="cd-chip cd-chip--{{ tono(doc.vigencia) }}"
                [attr.data-testid]="'vigencia-' + doc.id"
              >{{ etiqueta(doc.vigencia) }}</span>
            }
            @if (doc.estadoTexto) {
              <span
                class="cd-chip cd-chip--{{ doc.estadoTono ?? 'espera' }}"
                [attr.data-testid]="'estado-' + doc.id"
              >{{ doc.estadoTexto }}</span>
            }
          </div>
        </div>
        @if (doc.observaciones) {
          <p class="cd-liq__meta">{{ doc.observaciones }}</p>
        }
      </article>
    }
  `,
})
export class DocumentosListaComponent {
  readonly documentos = input.required<readonly DocumentoVista[]>();

  protected readonly filas = computed<FilaDocumento[]>(() =>
    this.documentos().map((doc) => ({ ...doc, vigencia: vigenciaDocumento(doc.vencimiento) })),
  );

  protected legible(iso: string): string {
    return fechaLegible(iso);
  }

  protected etiqueta(vigencia: VigenciaDocumento): string {
    return etiquetaVigencia(vigencia);
  }

  protected tono(vigencia: VigenciaDocumento): string {
    return TONO_VIGENCIA[vigencia];
  }
}
