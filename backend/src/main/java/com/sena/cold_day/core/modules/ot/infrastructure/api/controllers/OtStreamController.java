package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.application.usecases.ConsultarOtUseCase;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.listeners.OtEstadoCambiadoSseListener;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;
import com.sena.cold_day.core.shared.infrastructure.security.AutorizacionPropietario;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketConsumido;
import com.sena.cold_day.core.shared.infrastructure.sse.TicketSseInvalidoException;

/**
 * Real-time OT state stream over Server-Sent Events.
 *
 * <p>{@code EventSource} cannot send an {@code Authorization} header, so the
 * stream is authenticated with a single-use ticket passed as a query
 * parameter. The ticket proves <em>identity</em> only; the participant rule of
 * {@link AutorizacionPropietario} still decides whether that identity may watch
 * this particular order.
 */
@RestController
@RequestMapping("/api/ot")
public class OtStreamController {

    private final ConsultarOtUseCase consultar;
    private final AutorizacionPropietario autorizacion;
    private final SseTicketService tickets;
    private final SseEmitterRegistry registry;

    public OtStreamController(ConsultarOtUseCase consultar, AutorizacionPropietario autorizacion,
            SseTicketService tickets, SseEmitterRegistry registry) {
        this.consultar = consultar;
        this.autorizacion = autorizacion;
        this.tickets = tickets;
        this.registry = registry;
    }

    /**
     * Opens the stream. The ticket is consumed first, then the participant
     * rule is enforced: a valid ticket belonging to a technician that is not
     * part of the order must not reach the stream.
     */
    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable OtId id,
            @RequestParam(value = "ticket", required = false) String ticket) {
        TicketConsumido consumido = tickets.consumir(ticket).orElseThrow(TicketSseInvalidoException::new);
        AuthenticatedUser principal = new AuthenticatedUser(consumido.usuarioId(), consumido.rol());
        OtResponse ot = consultar.consultar(id);
        autorizacion.exigirParticipanteOAdmin(principal, ot);
        return registry.crear(OtEstadoCambiadoSseListener.clave(id));
    }
}
