package com.sena.cold_day.core.modules.administracion.domain.entities;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.DisputaId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoDisputa;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;

/**
 * Administrative mediation of a disputed OT (RF-F1-25, SRS 5.3): a dispute is
 * born ABIERTA and can only be resolved once, with or without agreement.
 */
class DisputaTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final OtId OT = OtId.nueva();

    @Test
    void abrirCreatesAnOpenDispute() {
        Disputa disputa = Disputa.abrir(OT, "El trabajo quedo incompleto", AHORA);

        assertThat(disputa.getId()).isNotNull();
        assertThat(disputa.getOtId()).isEqualTo(OT);
        assertThat(disputa.getMotivo()).isEqualTo("El trabajo quedo incompleto");
        assertThat(disputa.getEstado()).isEqualTo(EstadoDisputa.ABIERTA);
        assertThat(disputa.getCreadaEn()).isEqualTo(AHORA);
        assertThat(disputa.getResolucion()).isNull();
        assertThat(disputa.getResueltaEn()).isNull();
    }

    @Test
    void abrirRejectsInvalidArguments() {
        assertThatThrownBy(() -> Disputa.abrir(null, "motivo", AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Disputa.abrir(OT, " ", AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Disputa.abrir(OT, null, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Disputa.abrir(OT, "motivo", null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resolverConAcuerdoClosesTheDispute() {
        Disputa disputa = Disputa.abrir(OT, "motivo", AHORA);

        disputa.resolverConAcuerdo("Se repara sin costo", AHORA);

        assertThat(disputa.getEstado()).isEqualTo(EstadoDisputa.RESUELTA_CON_ACUERDO);
        assertThat(disputa.getResolucion()).isEqualTo("Se repara sin costo");
        assertThat(disputa.getResueltaEn()).isEqualTo(AHORA);
    }

    @Test
    void resolverSinAcuerdoClosesTheDispute() {
        Disputa disputa = Disputa.abrir(OT, "motivo", AHORA);

        disputa.resolverSinAcuerdo("Cliente no acepta", AHORA);

        assertThat(disputa.getEstado()).isEqualTo(EstadoDisputa.RESUELTA_SIN_ACUERDO);
        assertThat(disputa.getResolucion()).isEqualTo("Cliente no acepta");
    }

    @Test
    void resolverRequiresAbiertaStateAndResolucion() {
        Disputa disputa = Disputa.abrir(OT, "motivo", AHORA);
        disputa.resolverConAcuerdo("ok", AHORA);

        assertThatThrownBy(() -> disputa.resolverConAcuerdo("otra vez", AHORA))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> disputa.resolverSinAcuerdo("otra vez", AHORA))
                .isInstanceOf(IllegalStateException.class);

        Disputa abierta = Disputa.abrir(OT, "motivo", AHORA);
        assertThatThrownBy(() -> abierta.resolverConAcuerdo(" ", AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> abierta.resolverSinAcuerdo(null, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reconstituirExposesPersistedState() {
        DisputaId id = DisputaId.nueva();
        Disputa disputa = Disputa.reconstituir(id, OT, "motivo", EstadoDisputa.RESUELTA_SIN_ACUERDO,
                "resolucion", AHORA, AHORA);

        assertThat(disputa.getId()).isEqualTo(id);
        assertThat(disputa.getEstado()).isEqualTo(EstadoDisputa.RESUELTA_SIN_ACUERDO);
        assertThat(disputa.getResolucion()).isEqualTo("resolucion");
        assertThat(disputa.getResueltaEn()).isEqualTo(AHORA);
    }

    @Test
    void esAbiertaOnlyForTheOpenState() {
        assertThat(EstadoDisputa.ABIERTA.esAbierta()).isTrue();
        assertThat(EstadoDisputa.RESUELTA_CON_ACUERDO.esAbierta()).isFalse();
        assertThat(EstadoDisputa.RESUELTA_SIN_ACUERDO.esAbierta()).isFalse();
    }
}
