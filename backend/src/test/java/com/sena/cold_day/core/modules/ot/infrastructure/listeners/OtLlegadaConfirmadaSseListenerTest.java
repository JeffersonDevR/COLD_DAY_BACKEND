package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.events.OtLlegadaConfirmada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/**
 * The arrival bridge: {@code OtLlegadaConfirmada} -> SSE registry.
 *
 * <p>The arrival is a fact and not a transition, so it never reaches the
 * repository drain loop and without this listener the client watching the
 * order would never learn that the technician had arrived.
 */
class OtLlegadaConfirmadaSseListenerTest {

    private static final Instant LLEGADA = Instant.parse("2026-10-21T15:30:00Z");

    private final RegistroEspia registro = new RegistroEspia();
    private final OtLlegadaConfirmadaSseListener listener = new OtLlegadaConfirmadaSseListener(registro);

    @Test
    void publishesTheArrivalUnderTheOtKeyWithTheStreamEventName() {
        OtId otId = OtId.nueva();

        listener.alConfirmarLlegada(new OtLlegadaConfirmada(otId, EstadoOt.EN_CAMINO, LLEGADA));

        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(otId.valor().toString());
        // The client keys off the same event name and payload shape it already
        // consumes, so the frontend needs no change.
        assertThat(registro.evento).isEqualTo(OtEstadoCambiadoSseListener.EVENTO);
        // The state did not change: the arrival instant is what the event
        // carries that a plain transition does not.
        assertThat(registro.payload).isEqualTo(new OtEstadoCambiadoSseApiResponse(
                otId.valor().toString(), EstadoOt.EN_CAMINO, EstadoOt.EN_CAMINO, LLEGADA));
    }

    @Test
    void serialisesThePayloadWithAScalarOtIdAndTheArrivalInstant() throws Exception {
        OtId otId = OtId.nueva();
        String json = new ObjectMapper().writeValueAsString(OtEstadoCambiadoSseApiResponse.deLlegada(
                otId, EstadoOt.EN_CAMINO, LLEGADA));

        assertThat(json).isEqualTo(
                "{\"otId\":\"%s\",\"origen\":\"EN_CAMINO\",\"destino\":\"EN_CAMINO\",\"llegadaEn\":\"2026-10-21T15:30:00Z\"}"
                        .formatted(otId.valor()));
        assertThat(json).doesNotContain("\"valor\"");
    }

    /** Registry that records the publication instead of sending it. */
    private static final class RegistroEspia extends SseEmitterRegistry {

        private String clave;
        private String evento;
        private Object payload;
        private int llamadas;

        private RegistroEspia() {
            super(new ObjectMapper(), 60_000L);
        }

        @Override
        public void publicar(String key, String eventName, Object object) {
            this.clave = key;
            this.evento = eventName;
            this.payload = object;
            this.llamadas++;
        }
    }
}
