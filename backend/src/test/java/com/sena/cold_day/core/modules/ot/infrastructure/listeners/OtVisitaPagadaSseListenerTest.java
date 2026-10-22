package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.events.OtVisitaPagada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/**
 * The visit payment bridge: {@code OtVisitaPagada} -> SSE registry.
 *
 * <p>Paying the visit of an assigned order does not change the state of the
 * order, so it never reaches the repository drain loop and without this
 * listener the technician watching the order would never learn that the client
 * paid.
 */
class OtVisitaPagadaSseListenerTest {

    private static final Instant PAGO = Instant.parse("2026-10-21T16:00:00Z");

    private final RegistroEspia registro = new RegistroEspia();
    private final OtVisitaPagadaSseListener listener = new OtVisitaPagadaSseListener(registro);

    @Test
    void publishesTheVisitPaymentUnderTheOtKeyWithTheStreamEventName() {
        OtId otId = OtId.nueva();

        listener.alPagarVisita(new OtVisitaPagada(otId, EstadoOt.ASIGNADA, PAGO));

        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(otId.valor().toString());
        // The client keys off the same event name and payload shape it already
        // consumes, so the frontend needs no change.
        assertThat(registro.evento).isEqualTo(OtEstadoCambiadoSseListener.EVENTO);
        // The state did not change: the payment instant is what the event
        // carries that a plain transition does not.
        assertThat(registro.payload).isEqualTo(new OtEstadoCambiadoSseApiResponse(
                otId.valor().toString(), EstadoOt.ASIGNADA, EstadoOt.ASIGNADA, null, PAGO));
    }

    @Test
    void serialisesThePayloadWithAScalarOtIdAndThePaymentInstant() throws Exception {
        OtId otId = OtId.nueva();
        String json = new ObjectMapper().writeValueAsString(OtEstadoCambiadoSseApiResponse.deVisitaPagada(
                otId, EstadoOt.ASIGNADA, PAGO));

        assertThat(json).isEqualTo(
                "{\"otId\":\"%s\",\"origen\":\"ASIGNADA\",\"destino\":\"ASIGNADA\",\"visitaPagadaEn\":\"2026-10-21T16:00:00Z\"}"
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
