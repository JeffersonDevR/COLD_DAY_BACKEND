package com.sena.cold_day.core.modules.ot.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.ot.domain.events.OfertaCreada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.api.responses.OfertaCreadaSseApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/**
 * The offer bridge: {@code OfertaCreada} -> SSE registry, under the technician
 * key. Without this listener dispatch creates the offers and tells the recipient
 * nothing, so a technician on any other screen never sees the 60-second window.
 */
class OfertaCreadaSseListenerTest {

    private final RegistroEspia registro = new RegistroEspia();
    private final OfertaCreadaSseListener listener = new OfertaCreadaSseListener(registro);

    @Test
    void publishesTheOfferUnderTheTechnicianKeyWithTheStreamEventName() {
        OtId otId = OtId.nueva();
        TecnicoId tecnicoId = TecnicoId.nueva();

        listener.alCrearOferta(new OfertaCreada(otId, tecnicoId));

        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(OfertaCreadaSseListener.claveTecnico(tecnicoId));
        assertThat(registro.evento).isEqualTo(OfertaCreadaSseListener.EVENTO);
        assertThat(registro.payload).isEqualTo(new OfertaCreadaSseApiResponse(otId.valor().toString()));
    }

    /**
     * The isolation the channel rests on: two technicians never share a bucket,
     * and a technician bucket can never be confused with an OT one.
     */
    @Test
    void keysEachTechnicianSeparatelyAndNeverCollidesWithAnOtKey() {
        TecnicoId primero = TecnicoId.nueva();
        TecnicoId segundo = TecnicoId.nueva();

        assertThat(OfertaCreadaSseListener.claveTecnico(primero))
                .isNotEqualTo(OfertaCreadaSseListener.claveTecnico(segundo))
                .isEqualTo("tecnico:" + primero.valor());
        // An OT stream key is the bare OT id, so the prefix makes the namespaces
        // disjoint by construction: no OT id can ever be a technician key.
        assertThat(OtEstadoCambiadoSseListener.clave(OtId.nueva()))
                .doesNotStartWith(OfertaCreadaSseListener.PREFIJO_TECNICO);
    }

    @Test
    void serialisesThePayloadWithAScalarOtId() throws Exception {
        OtId otId = OtId.nueva();
        String json = new ObjectMapper()
                .writeValueAsString(OfertaCreadaSseApiResponse.de(new OfertaCreada(otId, TecnicoId.nueva())));

        assertThat(json).isEqualTo("{\"otId\":\"%s\"}".formatted(otId.valor()));
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
