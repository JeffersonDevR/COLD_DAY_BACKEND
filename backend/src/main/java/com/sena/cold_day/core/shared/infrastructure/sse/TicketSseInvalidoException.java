package com.sena.cold_day.core.shared.infrastructure.sse;

/**
 * A ticket is missing, unknown, expired or already used. Mapped to 401 by the
 * stream controller advice so a bad credential never surfaces as a 500.
 */
public class TicketSseInvalidoException extends RuntimeException {

    public TicketSseInvalidoException() {
        super("Invalid, expired or already-used SSE ticket");
    }
}
