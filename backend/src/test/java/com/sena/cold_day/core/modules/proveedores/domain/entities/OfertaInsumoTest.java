package com.sena.cold_day.core.modules.proveedores.domain.entities;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Arrays;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Domain behaviour of a supplier offer (spec disp.R3/R4/R5, design "State
 * Machines"): one pending offer per notified supplier with a
 * server-authoritative expiry. Only {@code PENDIENTE} is actionable and the
 * rejection literal is {@code RECHAZADO}, never {@code RECHAZADA}.
 */
class OfertaInsumoTest {

    private static final Instant AHORA = Instant.parse("2026-09-23T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);

    @Test
    void creacionQuedaPendienteConLaVentana() {
        OfertaInsumo oferta = crear();

        assertThat(oferta.getId()).isNotNull();
        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE);
        assertThat(oferta.getCreadaEn()).isEqualTo(AHORA);
        assertThat(oferta.getExpiraEn()).isEqualTo(EXPIRA);
        assertThat(oferta.getResueltaEn()).isNull();
        assertThat(oferta.estaVigente(AHORA)).isTrue();
        assertThat(oferta.getEstado().estaPendiente()).isTrue();
    }

    @Test
    void creacionRequiereDatosObligatorios() {
        RequerimientoInsumoId requerimientoId = RequerimientoInsumoId.nueva();
        ProveedorId proveedorId = ProveedorId.nueva();

        assertThatThrownBy(() -> OfertaInsumo.crear(null, proveedorId, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaInsumo.crear(requerimientoId, null, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaInsumo.crear(requerimientoId, proveedorId, null, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaInsumo.crear(requerimientoId, proveedorId, AHORA, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OfertaInsumo.crear(requerimientoId, proveedorId, AHORA, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void estaVigenteRespetaElVencimiento() {
        OfertaInsumo oferta = crear();

        assertThat(oferta.estaVigente(EXPIRA.minusMillis(1))).isTrue();
        assertThat(oferta.estaVigente(EXPIRA)).isFalse();
        assertThat(oferta.estaVigente(EXPIRA.plusSeconds(1))).isFalse();
    }

    @Test
    void aceptarMuevePendienteAAceptada() {
        OfertaInsumo oferta = crear();

        Instant resolucion = AHORA.plusSeconds(10);
        oferta.aceptar(resolucion);

        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.ACEPTADA);
        assertThat(oferta.getResueltaEn()).isEqualTo(resolucion);
        assertThat(oferta.estaVigente(resolucion)).isFalse();
        assertThat(oferta.getEstado().estaPendiente()).isFalse();
    }

    @Test
    void rechazarRegistraElLiteralRechazadoYNoDejaVigente() {
        OfertaInsumo oferta = crear();

        oferta.rechazar(AHORA.plusSeconds(1));

        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.RECHAZADO);
        assertThat(oferta.getEstado().name()).isEqualTo("RECHAZADO");
        assertThat(oferta.getEstado().esTerminal()).isTrue();
        assertThat(oferta.estaVigente(AHORA.plusSeconds(1))).isFalse();
    }

    @Test
    void expirarMuevePendienteAExpirada() {
        OfertaInsumo oferta = crear();

        oferta.expirar(EXPIRA);

        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA);
        assertThat(oferta.getResueltaEn()).isEqualTo(EXPIRA);
        assertThat(oferta.getEstado().esTerminal()).isTrue();
    }

    @Test
    void cancelarInvalidaLaOfertaHermanaPerdedora() {
        OfertaInsumo oferta = crear();

        oferta.cancelar(AHORA.plusSeconds(2));

        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA);
        assertThat(oferta.getEstado().esTerminal()).isTrue();
    }

    @Test
    void resolverUnaOfertaNoPendienteLanza() {
        assertThatThrownBy(() -> {
            OfertaInsumo oferta = crear();
            oferta.aceptar(AHORA);
            oferta.aceptar(AHORA);
        }).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> {
            OfertaInsumo oferta = crear();
            oferta.rechazar(AHORA);
            oferta.expirar(AHORA);
        }).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> {
            OfertaInsumo oferta = crear();
            oferta.cancelar(AHORA);
            oferta.rechazar(AHORA);
        }).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> {
            OfertaInsumo oferta = crear();
            oferta.expirar(AHORA);
            oferta.cancelar(AHORA);
        }).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void estadoDeOfertaUsaRechazadoNoRechazada() {
        assertThat(Arrays.stream(OfertaInsumoEstado.values()).map(Enum::name))
                .containsExactly("PENDIENTE", "ACEPTADA", "RECHAZADO", "EXPIRADA", "CANCELADA")
                .doesNotContain("RECHAZADA");
    }

    @Test
    void soloLosEstadosDeCierrePorOfertaSonTerminales() {
        assertThat(OfertaInsumoEstado.RECHAZADO.esTerminal()).isTrue();
        assertThat(OfertaInsumoEstado.EXPIRADA.esTerminal()).isTrue();
        assertThat(OfertaInsumoEstado.CANCELADA.esTerminal()).isTrue();
        assertThat(OfertaInsumoEstado.PENDIENTE.esTerminal()).isFalse();
        assertThat(OfertaInsumoEstado.ACEPTADA.esTerminal()).isFalse();
    }

    @Test
    void reconstituirRestauraElEstadoCompleto() {
        OfertaInsumoId id = OfertaInsumoId.nueva();
        RequerimientoInsumoId requerimientoId = RequerimientoInsumoId.nueva();
        ProveedorId proveedorId = ProveedorId.nueva();

        OfertaInsumo oferta = OfertaInsumo.reconstituir(id, requerimientoId, proveedorId,
                OfertaInsumoEstado.EXPIRADA, AHORA, EXPIRA, EXPIRA);

        assertThat(oferta.getId()).isEqualTo(id);
        assertThat(oferta.getRequerimientoId()).isEqualTo(requerimientoId);
        assertThat(oferta.getProveedorId()).isEqualTo(proveedorId);
        assertThat(oferta.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA);
        assertThat(oferta.getResueltaEn()).isEqualTo(EXPIRA);
    }

    private OfertaInsumo crear() {
        return OfertaInsumo.crear(RequerimientoInsumoId.nueva(), ProveedorId.nueva(), AHORA, EXPIRA);
    }
}
