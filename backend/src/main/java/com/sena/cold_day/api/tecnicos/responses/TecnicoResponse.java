package com.sena.cold_day.api.tecnicos.responses;

import java.util.Set;

import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;

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
