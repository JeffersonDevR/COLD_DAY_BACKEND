package com.sena.cold_day.core.modules.administracion.infrastructure.listeners;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.sena.cold_day.core.modules.administracion.domain.events.ComprobanteCargado;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaAbierta;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaResuelta;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionAprobada;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRechazada;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRegistrada;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.AdminActividadSseApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidacionRechazada;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidado;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

/**
 * Bridges every administration-relevant domain event to the admin SSE channel.
 *
 * <p>One listener with one method per event, instead of one listener per event,
 * because the channel is a single broadcast: the admin panel does not care
 * which aggregate fired, only that something changed and which id to refresh.
 * The payload keeps the event kind in {@code tipo} so the client can decide
 * what to reload.
 *
 * <p>The stream is keyed by a single shared bucket: every admin subscriber
 * receives every admin event. That is correct here, unlike the per-OT and
 * per-technician channels, because all subscribers hold the same
 * {@code ADMINISTRADOR} role and there is no per-recipient data to isolate.
 *
 * <p>{@code phase = AFTER_COMMIT} is load-bearing for the same reason as the
 * other bridges: announcing a dispute or a liquidation while its transaction
 * is still open would push an activity that a later rollback erases.
 * {@code fallbackExecution = true} keeps the events flowing if a path ever
 * publishes outside a transaction.
 */
@Component
public class AdminActividadSseListener {

    /** SSE event name consumed by the client. */
    public static final String EVENTO = "admin-actividad";

    /** Event kinds carried in {@code tipo}. */
    public static final String DISPUTA_ABIERTA = "DISPUTA_ABIERTA";
    public static final String DISPUTA_RESUELTA = "DISPUTA_RESUELTA";
    public static final String COMPROBANTE_CARGADO = "COMPROBANTE_CARGADO";
    public static final String LIQUIDACION_REGISTRADA = "LIQUIDACION_REGISTRADA";
    public static final String LIQUIDACION_APROBADA = "LIQUIDACION_APROBADA";
    public static final String LIQUIDACION_RECHAZADA = "LIQUIDACION_RECHAZADA";
    public static final String TECNICO_VALIDADO = "TECNICO_VALIDADO";
    public static final String TECNICO_VALIDACION_RECHAZADA = "TECNICO_VALIDACION_RECHAZADA";

    /**
     * Single broadcast bucket. Not derived from an id on purpose: the channel
     * has exactly one audience, so there is nothing to namespace.
     */
    private static final String CLAVE_ADMIN = "admin";

    private final SseEmitterRegistry registry;
    private final Clock clock;

    public AdminActividadSseListener(SseEmitterRegistry registry, Clock clock) {
        this.registry = registry;
        this.clock = clock;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alAbrirDisputa(DisputaAbierta evento) {
        publicar(DISPUTA_ABIERTA, evento.disputaId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alResolverDisputa(DisputaResuelta evento) {
        publicar(DISPUTA_RESUELTA, evento.disputaId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCargarComprobante(ComprobanteCargado evento) {
        publicar(COMPROBANTE_CARGADO, evento.liquidacionId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alRegistrarLiquidacion(LiquidacionRegistrada evento) {
        publicar(LIQUIDACION_REGISTRADA, evento.liquidacionId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alAprobarLiquidacion(LiquidacionAprobada evento) {
        publicar(LIQUIDACION_APROBADA, evento.liquidacionId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alRechazarLiquidacion(LiquidacionRechazada evento) {
        publicar(LIQUIDACION_RECHAZADA, evento.liquidacionId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alValidarTecnico(TecnicoValidado evento) {
        publicar(TECNICO_VALIDADO, evento.tecnicoId().valor());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alRechazarValidacionTecnico(TecnicoValidacionRechazada evento) {
        publicar(TECNICO_VALIDACION_RECHAZADA, evento.tecnicoId().valor());
    }

    private void publicar(String tipo, UUID id) {
        registry.publicar(claveAdmin(), EVENTO, new AdminActividadSseApiResponse(tipo, id.toString(), clock.instant()));
    }

    /**
     * Stream key for the admin channel. The stream controller registers under
     * the same key, so the derivation lives in one place — same rule as
     * {@link com.sena.cold_day.core.modules.ot.infrastructure.listeners.OfertaCreadaSseListener#claveTecnico(
     * com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId)}.
     */
    public static String claveAdmin() {
        return CLAVE_ADMIN;
    }
}
