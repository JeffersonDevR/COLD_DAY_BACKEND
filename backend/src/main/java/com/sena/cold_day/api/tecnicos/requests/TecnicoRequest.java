package com.sena.cold_day.api.tecnicos.requests;

import java.util.Set;

import com.sena.cold_day.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.modules.tecnicos.domain.entities.Certificacion;
import com.sena.cold_day.modules.tecnicos.domain.entities.Tecnico;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Create/update payload for a technician. Mapping stays compact via
 * {@link #toEntity()} and {@link #applyTo(Tecnico)} (no mapper class).
 */
public record TecnicoRequest(
		@NotBlank String numeroIdentificacion,
		@NotBlank String nombres,
		@NotBlank String apellidos,
		String telefono,
		@Email String email,
		String fotoUrl,
		Set<CategoriaServicio> categoriasServicio,
		Set<Certificacion> certificaciones) {

	public Tecnico toEntity() {
		Tecnico tecnico = new Tecnico();
		applyTo(tecnico);
		return tecnico;
	}

	public void applyTo(Tecnico tecnico) {
		tecnico.setNumeroIdentificacion(numeroIdentificacion);
		tecnico.setNombres(nombres);
		tecnico.setApellidos(apellidos);
		tecnico.setTelefono(telefono);
		tecnico.setEmail(email);
		tecnico.setFotoUrl(fotoUrl);
		tecnico.setCategoriasServicio(categoriasServicio == null ? Set.of() : categoriasServicio);
		tecnico.setCertificaciones(certificaciones == null ? Set.of() : certificaciones);
	}
}
