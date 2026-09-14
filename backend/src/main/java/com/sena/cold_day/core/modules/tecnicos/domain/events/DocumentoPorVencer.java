package com.sena.cold_day.core.modules.tecnicos.domain.events;

import java.time.LocalDate;
import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.AudienciaNotificacion;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Pre-expiry notice (C3, RF-F1-03): a document or certification of an approved
 * technician is within the 30-day window. The payload carries both audiences so
 * the adapter can deliver to the technician and the administrator.
 */
public record DocumentoPorVencer(
		TecnicoId tecnicoId,
		String documento,
		LocalDate fechaVencimiento,
		long diasRestantes,
		Set<AudienciaNotificacion> audiencias) {

	public DocumentoPorVencer {
		audiencias = Set.copyOf(audiencias);
	}

	public static DocumentoPorVencer paraTecnicoYAdministrador(TecnicoId tecnicoId, String documento,
			LocalDate fechaVencimiento, long diasRestantes) {
		return new DocumentoPorVencer(tecnicoId, documento, fechaVencimiento, diasRestantes,
				Set.of(AudienciaNotificacion.TECNICO, AudienciaNotificacion.ADMINISTRADOR));
	}
}
