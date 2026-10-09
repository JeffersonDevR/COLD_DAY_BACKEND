package com.sena.cold_day.core.shared.infrastructure.sse;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Exchanges an authenticated JWT for a single-use SSE ticket.
 *
 * <p>Deliberately absent from the public allowlist: the default
 * {@code anyRequest().authenticated()} rule protects it, so only a caller
 * holding a valid JWT can obtain a ticket.
 */
@RestController
@RequestMapping("/api/sse")
public class SseTicketController {

    private final SseTicketService tickets;

    public SseTicketController(SseTicketService tickets) {
        this.tickets = tickets;
    }

    @PostMapping("/ticket")
    public TicketSseApiResponse emitir(@AuthenticationPrincipal AuthenticatedUser principal) {
        return new TicketSseApiResponse(tickets.emitir(principal), tickets.ttlSegundos());
    }
}
