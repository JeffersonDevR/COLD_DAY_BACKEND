package com.sena.cold_day.core.modules.proveedores.domain.aggregates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.sena.cold_day.core.modules.proveedores.domain.entities.RequerimientoInsumoItem;
import com.sena.cold_day.core.modules.proveedores.domain.exception.TransicionRequerimientoInvalidaException;
import com.sena.cold_day.core.modules.proveedores.domain.services.TransicionesRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Domain behaviour of an insumo request (spec disp.R1/R3/R4/R6/R7, design
 * "State Machines"): it starts {@code SOLICITADO} with the declared free-text
 * lines and a server-authoritative expiry, and only the transitions in the
 * table are reachable. {@code CANCELADO} is deliberately not a root state.
 */
class RequerimientoInsumoTest {

    private static final Instant AHORA = Instant.parse("2026-09-23T10:00:00Z");
    private static final Instant EXPIRA = AHORA.plusSeconds(900);

    @Test
    void creacionQuedaEnSolicitadoConLasLineasYLaVentana() {
        UUID otId = UUID.randomUUID();
        UUID tecnicoId = UUID.randomUUID();

        RequerimientoInsumo requerimiento = crear(otId, tecnicoId);

        assertThat(requerimiento.getId()).isNotNull();
        assertThat(requerimiento.getOtId()).isEqualTo(otId);
        assertThat(requerimiento.getTecnicoId()).isEqualTo(tecnicoId);
        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
        assertThat(requerimiento.getObservaciones()).isEqualTo("Falta el compresor");
        assertThat(requerimiento.getCreadaEn()).isEqualTo(AHORA);
        assertThat(requerimiento.getExpiraEn()).isEqualTo(EXPIRA);
        assertThat(requerimiento.getResueltaEn()).isNull();
        assertThat(requerimiento.getItems()).hasSize(2);
        assertThat(requerimiento.getItems()).extracting(RequerimientoInsumoItem::getDescripcion)
                .containsExactly("Compresor", "Capacitor");
        assertThat(requerimiento.getItems()).extracting(RequerimientoInsumoItem::getCantidad)
                .containsExactly(1, 2);
        assertThat(requerimiento.estaVigente(AHORA)).isTrue();
    }

    @Test
    void creacionRequiereAlMenosUnInsumo() {
        UUID otId = UUID.randomUUID();
        UUID tecnicoId = UUID.randomUUID();

        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, tecnicoId, null, null, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("al menos un insumo");
        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, tecnicoId, List.of(), null, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("al menos un insumo");
    }

    @Test
    void creacionRequiereDatosObligatorios() {
        UUID otId = UUID.randomUUID();
        UUID tecnicoId = UUID.randomUUID();
        List<InsumoLinea> lineas = lineas();

        assertThatThrownBy(() -> RequerimientoInsumo.crear(null, tecnicoId, lineas, null, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, null, lineas, null, AHORA, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, tecnicoId, lineas, null, null, EXPIRA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, tecnicoId, lineas, null, AHORA, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RequerimientoInsumo.crear(otId, tecnicoId, lineas, null, AHORA, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unaLineaRechazaDescripcionVaciaYCantidadNoPositiva() {
        assertThatThrownBy(() -> new InsumoLinea("  ", 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("descripcion");
        assertThatThrownBy(() -> new InsumoLinea(null, 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("descripcion");
        assertThatThrownBy(() -> new InsumoLinea("Compresor", 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cantidad");
        assertThatThrownBy(() -> new InsumoLinea("Compresor", -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cantidad");
    }

    @Test
    void asignarMueveSolicitadoAAsignado() {
        RequerimientoInsumo requerimiento = crear();

        requerimiento.asignar(EXPIRA.minusSeconds(1));

        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        assertThat(requerimiento.esTerminal()).isFalse();
        assertThat(requerimiento.estaVigente(EXPIRA.minusSeconds(1))).isFalse();
    }

    @Test
    void marcarEntregadoMueveAsignadoAEntregadoYQuedaTerminal() {
        RequerimientoInsumo requerimiento = crear();
        requerimiento.asignar(AHORA.plusSeconds(1));

        Instant entrega = AHORA.plusSeconds(60);
        requerimiento.marcarEntregado(entrega);

        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.ENTREGADO);
        assertThat(requerimiento.esTerminal()).isTrue();
        assertThat(requerimiento.getResueltaEn()).isEqualTo(entrega);
    }

    @Test
    void marcarSinProveedorMueveSolicitadoASinProveedorYEsRetriable() {
        RequerimientoInsumo requerimiento = crear();

        Instant resolucion = AHORA.plusSeconds(5);
        requerimiento.marcarSinProveedor(resolucion);

        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
        assertThat(requerimiento.esTerminal()).isFalse();
        assertThat(requerimiento.getResueltaEn()).isEqualTo(resolucion);
    }

    @Test
    void lasTransicionesProhibidasLanzanUnaTransicionInvalida() {
        // No se puede saltar ASIGNADO (SOLICITADO -> ENTREGADO).
        RequerimientoInsumo salto = crear();
        assertThatThrownBy(() -> salto.marcarEntregado(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);
        assertThat(salto.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);

        // ASIGNADO no puede ir a SIN_PROVEEDOR.
        RequerimientoInsumo asignado = crear();
        asignado.asignar(AHORA);
        assertThatThrownBy(() -> asignado.marcarSinProveedor(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);
        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);

        // ENTREGADO es terminal: ninguna salida.
        RequerimientoInsumo entregado = crear();
        entregado.asignar(AHORA);
        entregado.marcarEntregado(AHORA);
        for (EstadoRequerimiento destino : EstadoRequerimiento.values()) {
            assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.ENTREGADO, destino))
                    .as("ENTREGADO -> %s debe rechazarse", destino)
                    .isFalse();
        }
        assertThatThrownBy(() -> entregado.asignar(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);

        // SIN_PROVEEDOR no vuelve a ASIGNADO dentro de esta raiz.
        RequerimientoInsumo sinProveedor = crear();
        sinProveedor.marcarSinProveedor(AHORA);
        assertThatThrownBy(() -> sinProveedor.asignar(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);
        assertThat(sinProveedor.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
    }

    @Test
    void laTablaPermiteExactamenteLasTransicionesDelDiseno() {
        assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.SOLICITADO,
                EstadoRequerimiento.ASIGNADO)).isTrue();
        assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.SOLICITADO,
                EstadoRequerimiento.SIN_PROVEEDOR)).isTrue();
        assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.ASIGNADO,
                EstadoRequerimiento.ENTREGADO)).isTrue();

        assertThatCode(() -> TransicionesRequerimiento.validar(EstadoRequerimiento.SOLICITADO,
                EstadoRequerimiento.ASIGNADO)).doesNotThrowAnyException();

        assertThatThrownBy(() -> TransicionesRequerimiento.validar(null, EstadoRequerimiento.ASIGNADO))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TransicionesRequerimiento.validar(EstadoRequerimiento.ASIGNADO, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void estadoRequerimientoNoDeclaraCancelado() {
        assertThat(Arrays.stream(EstadoRequerimiento.values()).map(Enum::name))
                .doesNotContain("CANCELADO")
                .containsExactly("SOLICITADO", "ASIGNADO", "ENTREGADO", "SIN_PROVEEDOR");
    }

    @Test
    void estaVigenteRespetaElVencimiento() {
        RequerimientoInsumo requerimiento = crear();

        assertThat(requerimiento.estaVigente(EXPIRA.minusMillis(1))).isTrue();
        assertThat(requerimiento.estaVigente(EXPIRA)).isFalse();
        assertThat(requerimiento.estaVigente(EXPIRA.plusSeconds(1))).isFalse();
    }

    @Test
    void reconstituirRestauraElEstadoCompleto() {
        RequerimientoInsumoId id = RequerimientoInsumoId.nueva();
        UUID otId = UUID.randomUUID();
        UUID tecnicoId = UUID.randomUUID();
        List<RequerimientoInsumoItem> items = List.of(RequerimientoInsumoItem.reconstituir(9L, "Compresor", 1));

        RequerimientoInsumo requerimiento = RequerimientoInsumo.reconstituir(id, otId, tecnicoId,
                EstadoRequerimiento.ENTREGADO, "obs", items, AHORA, EXPIRA, EXPIRA);

        assertThat(requerimiento.getId()).isEqualTo(id);
        assertThat(requerimiento.getOtId()).isEqualTo(otId);
        assertThat(requerimiento.getTecnicoId()).isEqualTo(tecnicoId);
        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.ENTREGADO);
        assertThat(requerimiento.getObservaciones()).isEqualTo("obs");
        assertThat(requerimiento.getItems()).extracting(RequerimientoInsumoItem::getId).containsExactly(9L);
        assertThat(requerimiento.getResueltaEn()).isEqualTo(EXPIRA);
    }

    private RequerimientoInsumo crear() {
        return crear(UUID.randomUUID(), UUID.randomUUID());
    }

    private RequerimientoInsumo crear(UUID otId, UUID tecnicoId) {
        return RequerimientoInsumo.crear(otId, tecnicoId, lineas(), "Falta el compresor", AHORA, EXPIRA);
    }

    private List<InsumoLinea> lineas() {
        return List.of(new InsumoLinea("Compresor", 1), new InsumoLinea("Capacitor", 2));
    }
}
