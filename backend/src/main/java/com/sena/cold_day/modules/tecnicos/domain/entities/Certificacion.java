package com.sena.cold_day.modules.tecnicos.domain.entities;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Value object inside Tecnico aggregate.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Certificacion {

	private String nombre;
	private String institucion;
	private LocalDate fechaObtencion;

}
