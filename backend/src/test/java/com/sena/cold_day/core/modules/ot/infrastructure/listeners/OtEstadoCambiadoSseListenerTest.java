package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/** The bridge from the domain event to the SSE registry. */
class OtEstadoCambiadoSseListenerTest {

    private final RegistroEspia registro = new RegistroEspia();
    private final OtEstadoCambiadoSseListener listener = new OtEstadoCambiadoSseListener(registro);

    @Test
    void publishesUnderTheOtKeyWithTheStreamEventName() {
        OtId otId = OtId.nueva();
        OtEstadoCambiado evento = new OtEstadoCambiado(otId, EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO);

        listener.alCambiarEstado(evento);

        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(otId.valor().toString());
        assertThat(registro.evento).isEqualTo(OtEstadoCambiadoSseListener.EVENTO);
        // The payload is the wire record, not the domain event: the identifier
        // travels as a scalar string instead of nested as {"valor":"..."}.
        assertThat(registro.payload).isEqualTo(
                new OtEstadoCambiadoSseApiResponse(otId.valor().toString(), EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO));
    }

    @Test
    void serialisesThePayloadWithAScalarOtId() throws Exception {
        OtId otId = OtId.nueva();
        OtEstadoCambiado evento = new OtEstadoCambiado(otId, EstadoOt.ASIGNADA, EstadoOt.EN_CAMINO);
        String json = new ObjectMapper().writeValueAsString(OtEstadoCambiadoSseApiResponse.de(evento));

        assertThat(json).isEqualTo("{\"otId\":\"%s\",\"origen\":\"ASIGNADA\",\"destino\":\"EN_CAMINO\"}"
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
