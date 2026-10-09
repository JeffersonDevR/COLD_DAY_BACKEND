package com.sena.cold_day.core.shared.infrastructure.sse;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.sena.cold_day.core.modules.usuarios.domain.services.TokenGeneratorPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Issues single-use, short-lived tickets that authenticate an SSE stream.
 *
 * <p>{@code EventSource} cannot send an {@code Authorization} header, so the
 * stream endpoint cannot rely on the JWT filter. The client exchanges its JWT
 * for an opaque ticket over an authenticated call and presents that ticket as
 * a query parameter when opening the stream.
 *
 * <p>Tickets are stored as a SHA-256 hash of the raw code (never the code
 * itself), mirroring the password-reset house style. A ticket is consumed on
 * the first {@link #consumir(String)} call: the entry is removed before it is
 * validated, so a replay of the same code always fails.
 *
 * <p><strong>The TTL is checked when the stream is opened, not for the life of
 * the stream.</strong> A long-lived stream deliberately outlives its ticket:
 * once the identity has been proven and the emitter is attached, the ticket
 * has no further role. Do not "fix" this by re-validating mid-stream.
 */
@Component
public class SseTicketService {

    private final TokenGeneratorPort tokenGenerator;
    private final Clock clock;
    private final Duration ttl;
    private final Map<String, TicketPendiente> tickets = new ConcurrentHashMap<>();

    public SseTicketService(TokenGeneratorPort tokenGenerator, Clock clock,
            @Value("${app.sse.ticket-ttl-ms:30000}") long ttlMs) {
        this.tokenGenerator = tokenGenerator;
        this.clock = clock;
        this.ttl = Duration.ofMillis(ttlMs);
    }

    /** Issues a ticket bound to {@code principal} and returns the raw code. */
    public String emitir(AuthenticatedUser principal) {
        String codigo = tokenGenerator.generar();
        tickets.put(tokenGenerator.hash(codigo),
                new TicketPendiente(principal.usuarioId(), principal.rol(), clock.instant().plus(ttl)));
        return codigo;
    }

    /**
     * Validates and consumes a ticket. The entry is removed first, so the same
     * code can never be accepted twice, even under concurrent calls. An expired
     * ticket is rejected (and is already gone).
     */
    public Optional<TicketConsumido> consumir(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return Optional.empty();
        }
        TicketPendiente pendiente = tickets.remove(tokenGenerator.hash(codigo));
        if (pendiente == null || !pendiente.expiraEn().isAfter(clock.instant())) {
            return Optional.empty();
        }
        return Optional.of(new TicketConsumido(pendiente.usuarioId(), pendiente.rol()));
    }

    /** TTL in whole seconds, for the ticket response. */
    public long ttlSegundos() {
        return ttl.toSeconds();
    }

    /**
     * Sweeps expired tickets so abandoned ones do not accumulate. Consumption
     * already removes accepted and expired tickets on the happy path; this only
     * reclaims tickets that were never presented.
     */
    @Scheduled(fixedDelayString = "${app.sse.purge-ms:30000}")
    public void purgarExpirados() {
        Instant ahora = clock.instant();
        tickets.entrySet().removeIf(entry -> !entry.getValue().expiraEn().isAfter(ahora));
    }

    /** Number of tickets still held; package-private for the sweep test. */
    int pendientes() {
        return tickets.size();
    }

    private record TicketPendiente(UsuarioId usuarioId, Rol rol, Instant expiraEn) {
    }
}
