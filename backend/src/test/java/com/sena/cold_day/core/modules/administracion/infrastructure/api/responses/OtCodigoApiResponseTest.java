package com.sena.cold_day.core.modules.administracion.infrastructure.api.responses;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.administracion.application.dto.DisputaResponse;
import com.sena.cold_day.core.modules.administracion.application.dto.LiquidacionResponse;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.entities.Disputa;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.CodigoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * T2: the admin responses that reference an OT expose its readable code next to
 * the UUID, so the disputes and liquidaciones pages can name the order instead
 * of printing the id. The UUID stays: it remains the identity of the resource.
 */
class OtCodigoApiResponseTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final CodigoOt CODIGO = CodigoOt.de("OT-2026-0042");

    @Test
    void theDisputeResponseCarriesTheOrderCodeNextToItsUuid() {
        Disputa disputa = Disputa.abrir(OtId.nueva(), "Trabajo incompleto", AHORA);

        DisputaApiResponse api = DisputaApiResponse.from(
                DisputaResponse.fromDomain(disputa).conOtCodigo(CODIGO));

        assertThat(api.otCodigo()).isEqualTo("OT-2026-0042");
        assertThat(api.otId()).isEqualTo(disputa.getOtId().valor().toString());
    }

    @Test
    void theLiquidacionResponseCarriesTheOrderCodeNextToItsUuid() {
        Liquidacion liquidacion = Liquidacion.registrar(OtId.nueva(), TecnicoId.nueva(),
                new BigDecimal("100000.00"), MedioPago.EFECTIVO, new BigDecimal("0.15"), AHORA);

        LiquidacionApiResponse api = LiquidacionApiResponse.from(
                LiquidacionResponse.fromDomain(liquidacion).conOtCodigo(CODIGO));

        assertThat(api.otCodigo()).isEqualTo("OT-2026-0042");
        assertThat(api.otId()).isEqualTo(liquidacion.getOtId().valor().toString());
    }
}
