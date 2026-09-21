import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { ToastService } from '../../../core/shared/presentation/toast.service';
import { CategoriaServicio } from '../../../core/shared/domain/models/common.models';

@Component({
  selector: 'app-catalogo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-12 transition-colors">
      <!-- Hero Section -->
      <header class="relative overflow-hidden py-12 sm:py-16 bg-gradient-to-b from-sky-50/50 dark:from-sky-950/20 to-transparent rounded-3xl">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs font-bold mb-6">
            <mat-icon class="text-sm">location_on</mat-icon>
            Red Técnica Certificada en Cúcuta y Área Metropolitana
          </div>
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
            Intermediación Inmediata de <span class="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-cyan-500">Servicios Técnicos</span> Especializados
          </h1>
          <p class="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Conectamos hogares y empresas de Cúcuta con técnicos auditados en refrigeración, aire acondicionado, electricidad y electrodomésticos, con garantía formal y geolocalización en tiempo real.
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-4">
            <a
              routerLink="/registro"
              class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition-all hover:scale-105"
            >
              <mat-icon>handyman</mat-icon>
              Pedir Asistencia Inmediata
            </a>
            <a
              href="#cotizacion"
              class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <mat-icon>business</mat-icon>
              Cotización Corporativa B2B
            </a>
          </div>
        </div>
      </header>

      <!-- 4 Líneas de Servicio -->
      <section class="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-2xl mx-auto mb-12">
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight">Nuestras 4 Líneas de Servicio</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Personal con acreditación SENA, matrícula CONTE y protocolos de seguridad</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- 1. Aire Acondicionado -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-400 transition-all">
            <div class="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
              <mat-icon class="text-2xl">mode_fan</mat-icon>
            </div>
            <h3 class="text-lg font-bold">Aire Acondicionado</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Mantenimiento preventivo, presurización, recarga de refrigerante ecológico R410A/R32 e instalación de minisplits y centrales.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400">
              Garantía formal de 90 días
            </div>
          </div>

          <!-- 2. Refrigeración -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-400 transition-all">
            <div class="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
              <mat-icon class="text-2xl">kitchen</mat-icon>
            </div>
            <h3 class="text-lg font-bold">Refrigeración</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Reparación de neveras no-frost, congeladores comerciales, botelleros, cuartos fríos y vitrinas de exhibición.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              Repuestos homologados
            </div>
          </div>

          <!-- 3. Electricidad -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-400 transition-all">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <mat-icon class="text-2xl">bolt</mat-icon>
            </div>
            <h3 class="text-lg font-bold">Electricidad</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Tableros de distribución, breakers, corrección de fugas de corriente, iluminación comercial y redes bajo normativa RETIE.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Técnicos Matrícula CONTE
            </div>
          </div>

          <!-- 4. Electrodomésticos -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-400 transition-all">
            <div class="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <mat-icon class="text-2xl">local_laundry_service</mat-icon>
            </div>
            <h3 class="text-lg font-bold">Electrodomésticos</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Lavadoras digitales, secadoras a gas y eléctricas, microondas, campanas extractoras y estufas industriales.
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Diagnóstico en sitio
            </div>
          </div>
        </div>
      </section>

      <!-- Formulario de Lead Cotización B2B -->
      <section id="cotizacion" class="py-16 bg-slate-100 dark:bg-slate-900/50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-lg">
            <div class="max-w-2xl mx-auto text-center mb-8">
              <span class="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Atención Corporativa</span>
              <h2 class="text-2xl sm:text-3xl font-bold mt-1">Solicitar Cotización Empresarial</h2>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
                Ideal para clínicas, restaurantes, colegios, conjuntos residenciales y locales comerciales de Cúcuta.
              </p>
            </div>

            <form [formGroup]="leadForm" (ngSubmit)="onEnviarLead()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="lead-empresa" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Empresa *</label>
                  <input
                    id="lead-empresa"
                    type="text"
                    formControlName="empresa"
                    placeholder="Ej. Distribuciones del Norte S.A.S."
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label for="lead-contacto" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Persona de Contacto *</label>
                  <input
                    id="lead-contacto"
                    type="text"
                    formControlName="contacto"
                    placeholder="Ej. Ing. Sofía Valencia"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="lead-correo" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico *</label>
                  <input
                    id="lead-correo"
                    type="email"
                    formControlName="correo"
                    placeholder="contacto@empresa.com"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label for="lead-telefono" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono Móvil *</label>
                  <input
                    id="lead-telefono"
                    type="tel"
                    formControlName="telefono"
                    placeholder="Ej. 3151234567"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label for="lead-categoria" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Línea Requerida</label>
                  <select
                    id="lead-categoria"
                    formControlName="categoriaServicio"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="AIRE_ACONDICIONADO">Aire Acondicionado</option>
                    <option value="REFRIGERACION">Refrigeración</option>
                    <option value="ELECTRICIDAD">Electricidad</option>
                    <option value="ELECTRODOMESTICOS">Electrodomésticos</option>
                  </select>
                </div>
              </div>

              <div>
                <label for="lead-descripcion" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Detalle del Requerimiento *</label>
                <textarea
                  id="lead-descripcion"
                  rows="3"
                  formControlName="descripcion"
                  placeholder="Describe la cantidad de equipos, ubicación y necesidades de mantenimiento preventivo o correctivo..."
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              <div class="flex justify-end pt-2">
                <button
                  type="submit"
                  [disabled]="leadForm.invalid"
                  class="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md transition-colors inline-flex items-center gap-2"
                >
                  <mat-icon class="text-sm">send</mat-icon>
                  Enviar Solicitud de Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <!-- Reseñas y Testimonios en Cúcuta -->
      <section class="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-2xl mx-auto mb-10">
          <h2 class="text-2xl sm:text-3xl font-bold">Confianza Comprobada en Norte de Santander</h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Calificaciones reales de clientes y técnicos en Cúcuta</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400 mb-3">
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
            </div>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "El técnico Juan Pérez llegó en menos de 25 minutos al barrio Caobos. Diagnosticó la fuga de agua del aire y me entregó el acta de garantía digital."
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span class="font-bold">María Gómez</span>
              <span class="text-slate-400">Los Caobos</span>
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400 mb-3">
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
            </div>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "Excelente plataforma. Como técnico certificado del SENA tengo trabajo constante cerca de mi zona y las liquidaciones son totalmente transparentes."
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span class="font-bold">Andrés Silva (Técnico)</span>
              <span class="text-slate-400">La Riviera</span>
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400 mb-3">
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star</mat-icon>
              <mat-icon class="text-sm">star_half</mat-icon>
            </div>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "El radar muestra en tiempo real cómo avanza el técnico hacia tu casa. La transparencia en el costo de mano de obra y repuestos da total seguridad."
            </p>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span class="font-bold">Roberto Torres</span>
              <span class="text-slate-400">Guaimaral</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class CatalogoPage {
  private readonly mockDb = inject(MockDbService);
  private readonly toast = inject(ToastService);

  readonly leadForm = new FormGroup({
    empresa: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contacto: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    categoriaServicio: new FormControl<CategoriaServicio>('AIRE_ACONDICIONADO', { nonNullable: true }),
    cantidadEquipos: new FormControl(5, { nonNullable: true }),
    descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  onEnviarLead(): void {
    if (this.leadForm.invalid) return;

    const val = this.leadForm.getRawValue();
    this.mockDb.guardarLeadCotizacion(val);
    this.toast.success('Cotización Enviada', 'Un asesor de COLD DAY se comunicará contigo.');
    this.leadForm.reset({
      categoriaServicio: 'AIRE_ACONDICIONADO',
      cantidadEquipos: 5
    });
  }
}
