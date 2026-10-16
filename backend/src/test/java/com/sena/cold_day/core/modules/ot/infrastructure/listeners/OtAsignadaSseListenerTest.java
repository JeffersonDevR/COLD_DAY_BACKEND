package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.events.OtAsignada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OtEstadoCambiadoSseApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/**
 * The assignment bridge: {@code OtAsignada} -> SSE registry. The transition
 * does not pass the repository drain loop, so without this listener the client
 * never learns the order it is watching got assigned.
 */
class OtAsignadaSseListenerTest {

    private final RegistroEspia registro = new RegistroEspia();
    private final OtAsignadaSseListener listener = new OtAsignadaSseListener(registro);

    @Test
    void publishesTheAssignmentUnderTheOtKeyWithTheStreamEventName() {
        OtId otId = OtId.nueva();

        listener.alAsignar(new OtAsignada(otId, TecnicoId.nueva(), ClienteId.nueva()));

        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(otId.valor().toString());
        // The client keys off the same event name and payload shape it already
        // consumes, so the frontend needs no change.
        assertThat(registro.evento).isEqualTo(OtEstadoCambiadoSseListener.EVENTO);
        assertThat(registro.payload).isEqualTo(new OtEstadoCambiadoSseApiResponse(
                otId.valor().toString(), EstadoOt.BUSCANDO_TECNICO, EstadoOt.ASIGNADA));
    }

    @Test
    void serialisesThePayloadWithAScalarOtId() throws Exception {
        OtId otId = OtId.nueva();
        String json = new ObjectMapper().writeValueAsString(OtEstadoCambiadoSseApiResponse.de(
                otId, EstadoOt.BUSCANDO_TECNICO, EstadoOt.ASIGNADA));

        assertThat(json).isEqualTo(
                "{\"otId\":\"%s\",\"origen\":\"BUSCANDO_TECNICO\",\"destino\":\"ASIGNADA\"}"
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
