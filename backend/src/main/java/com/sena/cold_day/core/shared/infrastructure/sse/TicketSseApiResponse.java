package com.sena.cold_day.core.shared.infrastructure.sse;

/** Single-use ticket a client uses to open one SSE stream. */
public record TicketSseApiResponse(String codigo, long expiraEnSegundos) {
}
