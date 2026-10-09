package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.events.OtEstadoCambiado;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
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
        assertThat(registro.payload).isEqualTo(evento);
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
