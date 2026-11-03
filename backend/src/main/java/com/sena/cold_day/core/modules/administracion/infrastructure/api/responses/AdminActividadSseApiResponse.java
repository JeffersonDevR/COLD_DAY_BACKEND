package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Wire shape of the {@code admin-actividad} SSE event.
 *
 * <p>{@code tipo} is the scalar event kind the admin panel switches on, and
 * {@code id} is the affected aggregate identifier as a plain string: the same
 * scalar-id convention as {@code OtEstadoCambiadoSseApiResponse}, so a client
 * never has to reach one level in for {@code {"valor":"..."}}.
 *
 * <p>{@code ocurridaEn} is the publication instant. The domain events carry no
 * timestamp of their own, and the admin panel only needs "something changed"
 * plus an ordering hint to debounce its reloads.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminActividadSseApiResponse(String tipo, String id, Instant ocurridaEn) {
}
