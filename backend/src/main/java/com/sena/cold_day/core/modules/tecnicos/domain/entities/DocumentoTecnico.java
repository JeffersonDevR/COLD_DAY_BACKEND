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
	private LocalDate fechaVencimiento;

	public boolean estaVigente() {
		return fechaVencimiento != null && !fechaVencimiento.isBefore(LocalDate.now());
	}
}
