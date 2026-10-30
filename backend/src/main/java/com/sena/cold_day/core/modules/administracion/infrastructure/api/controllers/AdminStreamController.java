package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.sena.cold_day.core.modules.administracion.infrastructure.listeners.AdminActividadSseListener;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketConsumido;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketSseInvalidoException;

/**
 * Administration activity stream over Server-Sent Events.
 *
 * <p>Third channel of the ticket-based family ({@code OtStreamController},
 * {@code TecnicoOfertasStreamController}): the admin panel had to poll every
 * screen to learn that a dispute or a liquidation had landed, and a poll only
 * runs while its page is open.
 *
 * <p>Same transport contract: {@code EventSource} cannot send an
 * {@code Authorization} header, so the stream is opened with a single-use
 * ticket. The ticket proves <em>identity and roles</em>; the role check is
 * enforced here, from the ticket, instead of the filter chain, which cannot
 * see the ticket.
 *
 * <p>There is no id in the path: the channel is a single broadcast bucket
 * shared by every administrator, so a caller can only subscribe to the admin
 * feed, never to someone else's.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminStreamController {

    private final SseTicketService tickets;
    private final SseEmitterRegistry registry;

    public AdminStreamController(SseTicketService tickets, SseEmitterRegistry registry) {
        this.tickets = tickets;
        this.registry = registry;
    }

    /**
     * Opens the stream. The ticket is consumed first, then the administrator
     * role is required: a valid ticket belonging to a client or a technician
     * must not reach the admin feed.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(value = "ticket", required = false) String ticket) {
        TicketConsumido consumido = tickets.consumir(ticket).orElseThrow(TicketSseInvalidoException::new);
        AuthenticatedUser principal = new AuthenticatedUser(consumido.usuarioId(), consumido.rol(), consumido.roles());
        if (!principal.tieneRol(Rol.ADMINISTRADOR)) {
            throw new AccessDeniedException("The authenticated user is not an administrator");
        }
        return registry.crear(AdminActividadSseListener.claveAdmin());
    }
}
