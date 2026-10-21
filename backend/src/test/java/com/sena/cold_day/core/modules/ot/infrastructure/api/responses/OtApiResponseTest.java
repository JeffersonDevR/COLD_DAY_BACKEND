package com.sena.cold_day.core.modules.ot.infrastructure.api.responses;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.application.dto.OtResponse;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * WS5/R3: the API projection must expose {@code visitaPagada} so the client and
 * technician UIs can reflect (and gate on) the visit payment state.
 */
class OtApiResponseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Test
    void exponeLaVisitaPagadaCuandoLaOtYaFueCobrada() {
        Ot ot = otAsignada();
        ot.registrarPagoVisita("TARJETA", AHORA);

        OtApiResponse respuesta = OtApiResponse.from(OtResponse.fromDomain(ot));

        assertThat(respuesta.visitaPagada()).isTrue();
        assertThat(respuesta.medioPagoVisita()).isEqualTo("TARJETA");
    }

    @Test
    void exponeLaVisitaComoNoPagadaCuandoAunNoSeCobra() {
        Ot ot = otAsignada();

        OtApiResponse respuesta = OtApiResponse.from(OtResponse.fromDomain(ot));

        assertThat(respuesta.visitaPagada()).isFalse();
        assertThat(respuesta.medioPagoVisita()).isNull();
    }

    private Ot otAsignada() {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), TecnicoId.nueva(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(4.6, -74.0), EstadoOt.ASIGNADA, 10.0, AHORA.plusSeconds(60), AHORA, AHORA,
                null, null, null, null, null, null);
    }

    /**
     * The arrival instant has to travel on the OT projection: it is a fact and
     * not a transition, so no state tells the client that the technician
     * arrived.
     */
    @Test
    void exponeLaLlegadaSoloCuandoElTecnicoLaConfirma() {
        Ot ot = otEnCamino();
        assertThat(OtApiResponse.from(OtResponse.fromDomain(ot)).llegadaEn()).isNull();

        ot.confirmarLlegada(ActorOt.TECNICO, AHORA.plusSeconds(120));

        assertThat(OtApiResponse.from(OtResponse.fromDomain(ot)).llegadaEn()).isEqualTo(AHORA.plusSeconds(120));
    }

    private Ot otEnCamino() {
        return Ot.reconstituir(OtId.nueva(), ClienteId.nueva(), TecnicoId.nueva(),
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1",
                new Point(4.6, -74.0), EstadoOt.EN_CAMINO, 10.0, AHORA.plusSeconds(60), AHORA, AHORA,
                null, null, null, null, null, null);
    }
}
