package com.sena.cold_day.core.shared.infrastructure.sse;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.security.SecureRandomTokenGenerator;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;

/**
 * Unit tests for the single-use SSE ticket store: accepted once, replay
 * rejected, expired rejected, identities never cross, and the sweep reclaims
 * tickets that were never presented.
 */
class SseTicketServiceTest {

    private static final long TTL_MS = 30_000L;

    private final RelojMutable reloj = new RelojMutable(Instant.parse("2026-10-09T10:00:00Z"));
    private final SseTicketService servicio = new SseTicketService(new SecureRandomTokenGenerator(),
            reloj, TTL_MS);

    @Test
    void acceptsAFreshTicketOnceAndRejectsTheReplay() {
        String codigo = servicio.emitir(new AuthenticatedUser(new UsuarioId(1L), Rol.CLIENTE));

        Optional<TicketConsumido> primero = servicio.consumir(codigo);
        Optional<TicketConsumido> replay = servicio.consumir(codigo);

        assertThat(primero).hasValueSatisfying(t -> {
            assertThat(t.usuarioId()).isEqualTo(new UsuarioId(1L));
            assertThat(t.rol()).isEqualTo(Rol.CLIENTE);
        });
        assertThat(replay).isEmpty();
    }

    @Test
    void rejectsAnExpiredTicket() {
        String codigo = servicio.emitir(new AuthenticatedUser(new UsuarioId(2L), Rol.TECNICO));

        reloj.avanzar(Duration.ofMillis(TTL_MS + 1));

        assertThat(servicio.consumir(codigo)).isEmpty();
    }

    @Test
    void twoTicketsForDifferentPrincipalsDoNotCross() {
        String deTecnico = servicio.emitir(new AuthenticatedUser(new UsuarioId(10L), Rol.TECNICO));
        String deCliente = servicio.emitir(new AuthenticatedUser(new UsuarioId(20L), Rol.CLIENTE));

        assertThat(servicio.consumir(deTecnico)).hasValueSatisfying(t -> {
            assertThat(t.usuarioId()).isEqualTo(new UsuarioId(10L));
            assertThat(t.rol()).isEqualTo(Rol.TECNICO);
        });
        assertThat(servicio.consumir(deCliente)).hasValueSatisfying(t -> {
            assertThat(t.usuarioId()).isEqualTo(new UsuarioId(20L));
            assertThat(t.rol()).isEqualTo(Rol.CLIENTE);
        });
    }

    @Test
    void rejectsMissingOrBlankCodesWithoutTouchingTheStore() {
        servicio.emitir(new AuthenticatedUser(new UsuarioId(3L), Rol.CLIENTE));

        assertThat(servicio.consumir(null)).isEmpty();
        assertThat(servicio.consumir("  ")).isEmpty();
        assertThat(servicio.pendientes()).isEqualTo(1);
    }

    @Test
    void purgeReclaimsTicketsThatWereNeverPresented() {
        servicio.emitir(new AuthenticatedUser(new UsuarioId(4L), Rol.CLIENTE));
        servicio.emitir(new AuthenticatedUser(new UsuarioId(5L), Rol.CLIENTE));
        assertThat(servicio.pendientes()).isEqualTo(2);

        reloj.avanzar(Duration.ofMillis(TTL_MS + 1));
        servicio.purgarExpirados();

        assertThat(servicio.pendientes()).isZero();
    }

    @Test
    void purgeKeepsStillValidTickets() {
        String vigente = servicio.emitir(new AuthenticatedUser(new UsuarioId(6L), Rol.CLIENTE));

        servicio.purgarExpirados();

        assertThat(servicio.pendientes()).isEqualTo(1);
        assertThat(servicio.consumir(vigente)).isPresent();
    }

    /** Controllable {@link Clock} so expiry is deterministic without sleeps. */
    private static final class RelojMutable extends Clock {

        private Instant ahora;

        private RelojMutable(Instant inicial) {
            this.ahora = inicial;
        }

        private void avanzar(Duration delta) {
            this.ahora = ahora.plus(delta);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return ahora;
        }
    }
}
