package com.sena.cold_day.core.modules.administracion.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.administracion.domain.valueobjects.EstadoLiquidacion;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;

/**
 * Lifecycle of the cash/transfer settlement (RF-F1-23/24/26, CU-12/13): the
 * commission is computed on registration, the receipt upload opens the admin
 * verification window and only a decision from EN_VERIFICACION is legal.
 */
class LiquidacionTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final OtId OT = OtId.nueva();
    private static final TecnicoId TECNICO = TecnicoId.nueva();

    @Test
    void registrarComputesCommissionAndStartsPendingConsignacion() {
        Liquidacion liquidacion = Liquidacion.registrar(OT, TECNICO, new BigDecimal("200000.00"),
                MedioPago.EFECTIVO, new BigDecimal("0.15"), AHORA);

        assertThat(liquidacion.getId()).isNotNull();
        assertThat(liquidacion.getOtId()).isEqualTo(OT);
        assertThat(liquidacion.getTecnicoId()).isEqualTo(TECNICO);
        assertThat(liquidacion.getMontoCobrado()).isEqualByComparingTo("200000.00");
        assertThat(liquidacion.getValorComision()).isEqualByComparingTo("30000.00");
        assertThat(liquidacion.getPorcentajeComision()).isEqualByComparingTo("0.15");
        assertThat(liquidacion.getMedioPago()).isEqualTo(MedioPago.EFECTIVO);
        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.PENDIENTE_CONSIGNACION);
        assertThat(liquidacion.getCreadaEn()).isEqualTo(AHORA);
        assertThat(liquidacion.getComprobanteUrl()).isNull();
        assertThat(liquidacion.getVerificadaEn()).isNull();
    }

    @Test
    void registrarRejectsInvalidArguments() {
        assertThatThrownBy(() -> Liquidacion.registrar(null, TECNICO, BigDecimal.TEN,
                MedioPago.EFECTIVO, BigDecimal.ZERO, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, null, BigDecimal.TEN,
                MedioPago.EFECTIVO, BigDecimal.ZERO, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, null,
                MedioPago.EFECTIVO, BigDecimal.ZERO, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, BigDecimal.ZERO,
                MedioPago.EFECTIVO, BigDecimal.ZERO, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, BigDecimal.TEN,
                null, BigDecimal.ZERO, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, BigDecimal.TEN,
                MedioPago.EFECTIVO, null, AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, BigDecimal.TEN,
                MedioPago.EFECTIVO, new BigDecimal("1.5"), AHORA)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Liquidacion.registrar(OT, TECNICO, BigDecimal.TEN,
                MedioPago.EFECTIVO, BigDecimal.ZERO, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cargarComprobanteMovesToVerificacionAndClearsRejection() {
        Liquidacion liquidacion = liquidacionPendiente();

        liquidacion.cargarComprobante("https://cdn/coldday/comprobante.jpg");

        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.EN_VERIFICACION);
        assertThat(liquidacion.getComprobanteUrl()).isEqualTo("https://cdn/coldday/comprobante.jpg");
        assertThat(liquidacion.getMotivoRechazo()).isNull();
    }

    @Test
    void cargarComprobanteRejectsBlankUrlAndWrongState() {
        Liquidacion pendiente = liquidacionPendiente();
        assertThatThrownBy(() -> pendiente.cargarComprobante("  ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pendiente.cargarComprobante(null)).isInstanceOf(IllegalArgumentException.class);

        Liquidacion aprobada = liquidacionEnVerificacion();
        aprobada.aprobar(AHORA);
        assertThatThrownBy(() -> aprobada.cargarComprobante("https://cdn/x.jpg"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aprobarOnlyFromVerificacionAndStampsVerificadaEn() {
        Liquidacion liquidacion = liquidacionEnVerificacion();

        liquidacion.aprobar(AHORA);

        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.APROBADA);
        assertThat(liquidacion.getVerificadaEn()).isEqualTo(AHORA);
        assertThat(liquidacion.getMotivoRechazo()).isNull();

        assertThatThrownBy(() -> liquidacion.aprobar(AHORA)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rechazarRequiresVerificacionAndMotivo() {
        Liquidacion liquidacion = liquidacionEnVerificacion();

        liquidacion.rechazar("Comprobante ilegible", AHORA);

        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.RECHAZADA);
        assertThat(liquidacion.getMotivoRechazo()).isEqualTo("Comprobante ilegible");
        assertThat(liquidacion.getVerificadaEn()).isEqualTo(AHORA);

        Liquidacion otra = liquidacionEnVerificacion();
        assertThatThrownBy(() -> otra.rechazar(" ", AHORA)).isInstanceOf(IllegalArgumentException.class);

        Liquidacion pendiente = liquidacionPendiente();
        assertThatThrownBy(() -> pendiente.rechazar("motivo", AHORA)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rechazadaCanUploadTheReceiptAgain() {
        Liquidacion liquidacion = liquidacionEnVerificacion();
        liquidacion.rechazar("ilegible", AHORA);

        liquidacion.cargarComprobante("https://cdn/nuevo.jpg");

        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.EN_VERIFICACION);
        assertThat(liquidacion.getMotivoRechazo()).isNull();
    }

    @Test
    void reconstituirExposesPersistedState() {
        LiquidacionId id = LiquidacionId.nueva();
        Liquidacion liquidacion = Liquidacion.reconstituir(id, OT, TECNICO, new BigDecimal("100000.00"),
                MedioPago.TRANSFERENCIA, new BigDecimal("0.15"), new BigDecimal("15000.00"),
                EstadoLiquidacion.RECHAZADA, "https://cdn/c.jpg", "sin sello", AHORA, AHORA);

        assertThat(liquidacion.getId()).isEqualTo(id);
        assertThat(liquidacion.getMedioPago()).isEqualTo(MedioPago.TRANSFERENCIA);
        assertThat(liquidacion.getValorComision()).isEqualByComparingTo("15000.00");
        assertThat(liquidacion.getEstado()).isEqualTo(EstadoLiquidacion.RECHAZADA);
        assertThat(liquidacion.getComprobanteUrl()).isEqualTo("https://cdn/c.jpg");
        assertThat(liquidacion.getMotivoRechazo()).isEqualTo("sin sello");
        assertThat(liquidacion.getVerificadaEn()).isEqualTo(AHORA);
    }

    @Test
    void estadoBloqueaTecnicoOnlyWhileUnresolved() {
        assertThat(EstadoLiquidacion.PENDIENTE_CONSIGNACION.bloqueaTecnico()).isTrue();
        assertThat(EstadoLiquidacion.EN_VERIFICACION.bloqueaTecnico()).isTrue();
        assertThat(EstadoLiquidacion.RECHAZADA.bloqueaTecnico()).isTrue();
        assertThat(EstadoLiquidacion.APROBADA.bloqueaTecnico()).isFalse();
    }

    private Liquidacion liquidacionPendiente() {
        return Liquidacion.registrar(OT, TECNICO, new BigDecimal("100000.00"), MedioPago.EFECTIVO,
                new BigDecimal("0.15"), AHORA);
    }

    private Liquidacion liquidacionEnVerificacion() {
        Liquidacion liquidacion = liquidacionPendiente();
        liquidacion.cargarComprobante("https://cdn/comprobante.jpg");
        return liquidacion;
    }
}
