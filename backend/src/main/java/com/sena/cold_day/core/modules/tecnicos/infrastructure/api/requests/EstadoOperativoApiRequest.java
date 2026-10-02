package com.sena.cold_day.core.modules.tecnicos.infrastructure.api.requests;

import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;

import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code PUT /api/tecnicos/me/estado}.
 * <p>
 * Replaces the previous untyped {@code Map<String, String>} that read
 * {@code body.getOrDefault("estadoOperativo", "FUERA_DE_SERVICIO")}. That
 * default silently took a technician <b>out of service</b> on an empty body, and
 * an unknown string blew up with an opaque 500 from {@code Enum.valueOf}. The
 * state is now required and enum-typed, so a missing or invalid value is a
 * validated 400 instead of a silent state change.
 */
public record EstadoOperativoApiRequest(@NotNull EstadoOperativo estadoOperativo) {
}
