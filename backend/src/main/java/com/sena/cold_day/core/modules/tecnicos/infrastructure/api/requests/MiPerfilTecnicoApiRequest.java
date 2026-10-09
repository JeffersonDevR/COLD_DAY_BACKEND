package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import java.util.Set;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;

import jakarta.validation.constraints.NotEmpty;

/**
 * Body of the self-service specialization endpoint. {@code @NotEmpty} rejects
 * both a missing and an empty list at the API boundary; the aggregate keeps the
 * same rule as the last line of defence.
 */
public record MiPerfilTecnicoApiRequest(@NotEmpty Set<CategoriaServicio> categoriasServicio) {
}
