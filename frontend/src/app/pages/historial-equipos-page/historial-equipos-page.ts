import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/service/auth.service';

interface EquipoHistorial {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  ultimaIntervencion: string;
  repuestosInstalados: string[];
  garantiaActiva: boolean;
  diasGarantiaRestantes: number;
  tecnicoResponsable: string;
  otId: string;
}

@Component({
  selector: 'app-historial-equipos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './historial-equipos-page.html'
})
export class HistorialEquiposPage {
  readonly authService = inject(AuthService);

  readonly equipos = signal<EquipoHistorial[]>([
    {
      id: 'EQ-01',
      tipo: 'Aire Acondicionado',
      marca: 'LG Dual Inverter 12.000 BTU',
      modelo: 'VM121C6',
      ubicacion: 'Habitación Principal (Los Caobos)',
      ultimaIntervencion: '15 de Mayo 2026',
      repuestosInstalados: ['Capacitor 45uF CBB65', 'Gas R410A (1.5 lb)', 'Filtro deshidratador'],
      garantiaActiva: true,
      diasGarantiaRestantes: 68,
      tecnicoResponsable: 'Juan Pérez (SENA)',
      otId: 'OT-8821'
    },
    {
      id: 'EQ-02',
      tipo: 'Nevera / Refrigeración',
      marca: 'Whirlpool No-Frost 420L',
      modelo: 'WRX-48D',
      ubicacion: 'Cocina',
      ultimaIntervencion: '28 de Abril 2026',
      repuestosInstalados: ['Sensor bimetálico de descongelación', 'Resistencia tubular 110V'],
      garantiaActiva: true,
      diasGarantiaRestantes: 51,
      tecnicoResponsable: 'Andrés Silva (CONTE)',
      otId: 'OT-8822'
    },
    {
      id: 'EQ-03',
      tipo: 'Lavadora',
      marca: 'Samsung Wobble 18Kg',
      modelo: 'WA18F7L4',
      ubicacion: 'Área de Ropas',
      ultimaIntervencion: '10 de Febrero 2026',
      repuestosInstalados: ['Bomba de drenaje magnética', 'Correa de transmisión'],
      garantiaActiva: false,
      diasGarantiaRestantes: 0,
      tecnicoResponsable: 'Juan Pérez (SENA)',
      otId: 'OT-8819'
    }
  ]);
}
