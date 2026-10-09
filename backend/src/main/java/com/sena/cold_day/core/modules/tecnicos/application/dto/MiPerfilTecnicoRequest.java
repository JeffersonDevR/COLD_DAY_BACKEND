package com.sena.cold_day.core.modules.tecnicos.application.dto;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

/**
 * Self-service specialization update. Deliberately narrower than
 * {@link TecnicoRequest}: identity fields (name, email, password) are out of
 * scope for the authenticated technician's own profile edit.
 */
public record MiPerfilTecnicoRequest(Set<CategoriaServicio> categoriasServicio) {
}
