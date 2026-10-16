package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.sena.cold_day.core.modules.ot.infrastructure.listeners.OfertaCreadaSseListener;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;
import com.sena.cold_day.core.shared.infrastructure.security.AutorizacionPropietario;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketConsumido;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketSseInvalidoException;

/**
 * Technician-scoped offer stream over Server-Sent Events.
 *
 * <p>Companion of {@link OtStreamController}, for the gap the OT channel cannot
 * cover: "a new offer for me" has no OT to key on, so the technician had to be
 * on the offers page for its poll to run.
 *
 * <p>Same transport contract as the OT stream: {@code EventSource} cannot send
 * an {@code Authorization} header, so the stream is authenticated with a
 * single-use ticket. The ticket proves <em>identity</em> only; the technician
 * profile is then resolved from that identity.
 *
 * <p>There is deliberately no id in the path: the subscription target comes from
 * the ticket, so a caller can only ever subscribe to their own stream. There is
 * nothing to tamper with.
 */
@RestController
@RequestMapping("/api/tecnicos/me/ofertas")
public class TecnicoOfertasStreamController {

    private final AutorizacionPropietario autorizacion;
    private final SseTicketService tickets;
    private final SseEmitterRegistry registry;

    public TecnicoOfertasStreamController(AutorizacionPropietario autorizacion, SseTicketService tickets,
            SseEmitterRegistry registry) {
        this.autorizacion = autorizacion;
        this.tickets = tickets;
        this.registry = registry;
    }

    /**
     * Opens the stream. The ticket is consumed first, then the technician profile
     * is resolved from that identity: a valid ticket belonging to a user with no
     * active technician profile (a client, for example) must not reach the
     * stream.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(value = "ticket", required = false) String ticket) {
        TicketConsumido consumido = tickets.consumir(ticket).orElseThrow(TicketSseInvalidoException::new);
        AuthenticatedUser principal = new AuthenticatedUser(consumido.usuarioId(), consumido.rol(), consumido.roles());
        TecnicoId tecnicoId = autorizacion.tecnicoDelPrincipal(principal)
                .orElseThrow(() -> new AccessDeniedException(
                        "The authenticated user has no active technician profile"));
        return registry.crear(OfertaCreadaSseListener.claveTecnico(tecnicoId));
    }
}
