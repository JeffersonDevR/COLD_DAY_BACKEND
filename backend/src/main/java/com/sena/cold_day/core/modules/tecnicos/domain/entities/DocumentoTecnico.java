package com.sena.cold_day.core.modules.tecnicos.domain.entities;

import java.time.LocalDate;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Document uploaded by the tecnico and reviewed by the administrator (CU-03).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentoTecnico {

	private Long id;
	private TecnicoId tecnicoId;
	private String tipo;
	private LocalDate fechaExpedicion;
	private LocalDate fechaVencimiento;

	/**
	 * A document is valid only when it carries an issue date and, if it declares
	 * an expiry, that expiry is not in the past (M7). A null expiry is allowed.
	 */
	public boolean estaVigente(LocalDate hoy) {
		return fechaExpedicion != null
				&& (fechaVencimiento == null || !fechaVencimiento.isBefore(hoy));
	}
}
