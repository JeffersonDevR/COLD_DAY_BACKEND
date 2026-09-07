package com.sena.cold_day.tecnicos.api;

import java.util.Set;

import com.sena.cold_day.tecnicos.internal.domain.CategoriaServicio;
import com.sena.cold_day.tecnicos.internal.domain.Certificacion;
import com.sena.cold_day.tecnicos.internal.domain.EstadoOperativo;
import com.sena.cold_day.tecnicos.internal.domain.Tecnico;

/**
 * Technician representation returned by the module API.
 */
public record TecnicoResponse(
		Long id,
		String numeroIdentificacion,
		String nombres,
		String apellidos,
		String telefono,
		String email,
		String fotoUrl,
		Set<CategoriaServicio> categoriasServicio,
		EstadoOperativo estadoOperativo,
		Set<Certificacion> certificaciones,
		boolean activo) {

	public static TecnicoResponse from(Tecnico tecnico) {
		return new TecnicoResponse(tecnico.getId(), tecnico.getNumeroIdentificacion(), tecnico.getNombres(),
				tecnico.getApellidos(), tecnico.getTelefono(), tecnico.getEmail(), tecnico.getFotoUrl(),
				tecnico.getCategoriasServicio(), tecnico.getEstadoOperativo(), tecnico.getCertificaciones(),
				tecnico.isActivo());
	}
}
