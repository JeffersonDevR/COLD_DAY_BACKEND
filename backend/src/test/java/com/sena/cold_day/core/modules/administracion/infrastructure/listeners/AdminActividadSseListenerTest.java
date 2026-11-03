package com.sena.cold_day.core.modules.administracion.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.administracion.domain.events.ComprobanteCargado;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaAbierta;
import com.sena.cold_day.core.modules.administracion.domain.events.DisputaResuelta;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionAprobada;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRechazada;
import com.sena.cold_day.core.modules.administracion.domain.events.LiquidacionRegistrada;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.infrastructure.api.responses.AdminActividadSseApiResponse;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidacionRechazada;
import com.sena.cold_day.core.modules.tecnicos.domain.events.TecnicoValidado;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;

import tools.jackson.databind.ObjectMapper;

/**
 * The bridge from every admin-relevant domain event to the single admin
 * channel: one bucket, one event name, and a {@code tipo} that tells the panel
 * what changed.
 */
class AdminActividadSseListenerTest {

    private static final Instant AHORA = Instant.parse("2026-10-30T12:00:00Z");

    private final RegistroEspia registro = new RegistroEspia();
    private final AdminActividadSseListener listener =
            new AdminActividadSseListener(registro, Clock.fixed(AHORA, ZoneOffset.UTC));

    @Test
    void publishesDisputaAbiertaUnderTheAdminBucket() {
        DisputaId id = DisputaId.nueva();

        listener.alAbrirDisputa(new DisputaAbierta(id));

        assertPublicado(AdminActividadSseListener.DISPUTA_ABIERTA, id.valor());
    }

    @Test
    void publishesDisputaResueltaUnderTheAdminBucket() {
        DisputaId id = DisputaId.nueva();

        listener.alResolverDisputa(new DisputaResuelta(id, true));

        assertPublicado(AdminActividadSseListener.DISPUTA_RESUELTA, id.valor());
    }

    @Test
    void publishesComprobanteCargadoUnderTheAdminBucket() {
        LiquidacionId id = LiquidacionId.nueva();

        listener.alCargarComprobante(new ComprobanteCargado(id));

        assertPublicado(AdminActividadSseListener.COMPROBANTE_CARGADO, id.valor());
    }

    @Test
    void publishesLiquidacionRegistradaUnderTheAdminBucket() {
        LiquidacionId id = LiquidacionId.nueva();

        listener.alRegistrarLiquidacion(new LiquidacionRegistrada(id));

        assertPublicado(AdminActividadSseListener.LIQUIDACION_REGISTRADA, id.valor());
    }

    @Test
    void publishesLiquidacionAprobadaUnderTheAdminBucket() {
        LiquidacionId id = LiquidacionId.nueva();

        listener.alAprobarLiquidacion(new LiquidacionAprobada(id));

        assertPublicado(AdminActividadSseListener.LIQUIDACION_APROBADA, id.valor());
    }

    @Test
    void publishesLiquidacionRechazadaUnderTheAdminBucket() {
        LiquidacionId id = LiquidacionId.nueva();

        listener.alRechazarLiquidacion(new LiquidacionRechazada(id, "Comprobante ilegible"));

        assertPublicado(AdminActividadSseListener.LIQUIDACION_RECHAZADA, id.valor());
    }

    @Test
    void publishesTecnicoValidadoUnderTheAdminBucket() {
        TecnicoId id = TecnicoId.nueva();

        listener.alValidarTecnico(new TecnicoValidado(id));

        assertPublicado(AdminActividadSseListener.TECNICO_VALIDADO, id.valor());
    }

    @Test
    void publishesTecnicoValidacionRechazadaUnderTheAdminBucket() {
        TecnicoId id = TecnicoId.nueva();

        listener.alRechazarValidacionTecnico(new TecnicoValidacionRechazada(id, "Documentos vencidos"));

        assertPublicado(AdminActividadSseListener.TECNICO_VALIDACION_RECHAZADA, id.valor());
    }

    @Test
    void serialisesThePayloadWithTheDocumentedWireFields() throws Exception {
        String json = new ObjectMapper().writeValueAsString(new AdminActividadSseApiResponse(
                AdminActividadSseListener.LIQUIDACION_APROBADA, "id-1", AHORA));

        assertThat(json).isEqualTo(
                "{\"tipo\":\"LIQUIDACION_APROBADA\",\"id\":\"id-1\",\"ocurridaEn\":\"2026-10-30T12:00:00Z\"}");
        assertThat(json).doesNotContain("\"valor\"");
    }

    private void assertPublicado(String tipo, UUID id) {
        assertThat(registro.llamadas).isEqualTo(1);
        assertThat(registro.clave).isEqualTo(AdminActividadSseListener.claveAdmin());
        assertThat(registro.evento).isEqualTo(AdminActividadSseListener.EVENTO);
        // The payload is the wire record: the identifier travels as a scalar
        // string instead of nested as {"valor":"..."}.
        assertThat(registro.payload).isEqualTo(
                new AdminActividadSseApiResponse(tipo, id.toString(), AHORA));
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
