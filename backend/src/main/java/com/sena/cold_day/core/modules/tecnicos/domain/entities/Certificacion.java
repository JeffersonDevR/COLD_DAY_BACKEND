package com.sena.cold_day.core.modules.tecnicos.domain.entities;

import java.time.LocalDate;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Value object inside Tecnico aggregate. A certification records the date it
 * was obtained and the date it expires; validity is evaluated against an
 * explicit "today" so callers stay deterministic.
 */
@Data
@NoArgsConstructor
public class Certificacion {

	private String nombre;
	private String institucion;
	private LocalDate fechaObtencion;
	private LocalDate fechaVencimiento;

	public Certificacion(String nombre, String institucion, LocalDate fechaObtencion, LocalDate fechaVencimiento) {
		this.nombre = nombre;
		this.institucion = institucion;
		this.fechaObtencion = fechaObtencion;
		this.fechaVencimiento = fechaVencimiento;
	}

	/** Backwards-compatible constructor: no recorded expiry, so not vigente. */
	public Certificacion(String nombre, String institucion, LocalDate fechaObtencion) {
		this(nombre, institucion, fechaObtencion, null);
	}

	/** Vigente until the expiry date passes (still vigente on the expiry date itself). */
	public boolean estaVigente(LocalDate hoy) {
		return fechaVencimiento != null && !fechaVencimiento.isBefore(hoy);
	}

}
