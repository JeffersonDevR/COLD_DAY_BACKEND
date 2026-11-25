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
import com.sena.cold_day.core.shared.domain.Point;

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

        requerimiento.asignar();

        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        assertThat(requerimiento.esTerminal()).isFalse();
        assertThat(requerimiento.estaVigente(EXPIRA.minusSeconds(1))).isFalse();
    }

    @Test
    void marcarEntregadoMueveAsignadoAEntregadoYQuedaTerminal() {
        RequerimientoInsumo requerimiento = crear();
        requerimiento.asignar();
        requerimiento.despachar(AHORA.plusSeconds(30));

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
        asignado.asignar();
        assertThatThrownBy(() -> asignado.marcarSinProveedor(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);
        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);

        // ENTREGADO es terminal: ninguna salida.
        RequerimientoInsumo entregado = crear();
        entregado.asignar();
        entregado.despachar(AHORA);
        entregado.marcarEntregado(AHORA);
        for (EstadoRequerimiento destino : EstadoRequerimiento.values()) {
            assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.ENTREGADO, destino))
                    .as("ENTREGADO -> %s debe rechazarse", destino)
                    .isFalse();
        }
        assertThatThrownBy(() -> entregado.asignar())
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);

        // SIN_PROVEEDOR no vuelve a ASIGNADO dentro de esta raiz.
        RequerimientoInsumo sinProveedor = crear();
        sinProveedor.marcarSinProveedor(AHORA);
        assertThatThrownBy(() -> sinProveedor.asignar())
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
                EstadoRequerimiento.DESPACHADO)).isTrue();
        assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.DESPACHADO,
                EstadoRequerimiento.ENTREGADO)).isTrue();
        // La entrega exige haber despachado antes (diseno 2026-11-25).
        assertThat(TransicionesRequerimiento.esPermitida(EstadoRequerimiento.ASIGNADO,
                EstadoRequerimiento.ENTREGADO)).isFalse();

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
                .containsExactly("SOLICITADO", "ASIGNADO", "DESPACHADO", "ENTREGADO", "SIN_PROVEEDOR");
    }

    @Test
    void asignarConEtaGuardaEtaDistanciaYMomento() {
        RequerimientoInsumo requerimiento = crearConRadio();

        requerimiento.asignar(45, 12.5, AHORA.plusSeconds(20));

        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
        assertThat(requerimiento.getEtaMinutos()).isEqualTo(45);
        assertThat(requerimiento.getDistanciaKm()).isEqualTo(12.5);
        assertThat(requerimiento.getAceptadaEn()).isEqualTo(AHORA.plusSeconds(20));
    }

    @Test
    void asignarExigeEtaPositivo() {
        RequerimientoInsumo requerimiento = crearConRadio();

        assertThatThrownBy(() -> requerimiento.asignar(0, 1.0, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> requerimiento.asignar(-5, 1.0, AHORA))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(requerimiento.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
    }

    @Test
    void despacharSoloDesdeAsignadoYRegistraElMomento() {
        RequerimientoInsumo solicitado = crearConRadio();
        assertThatThrownBy(() -> solicitado.despachar(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);

        RequerimientoInsumo asignado = crearConRadio();
        asignado.asignar(30, 5.0, AHORA);
        asignado.despachar(AHORA.plusSeconds(90));

        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.DESPACHADO);
        assertThat(asignado.getDespachadaEn()).isEqualTo(AHORA.plusSeconds(90));
        assertThat(asignado.esTerminal()).isFalse();
    }

    @Test
    void entregarExigeDespachado() {
        RequerimientoInsumo asignado = crearConRadio();
        asignado.asignar(30, 5.0, AHORA);

        assertThatThrownBy(() -> asignado.marcarEntregado(AHORA))
                .isInstanceOf(TransicionRequerimientoInvalidaException.class);
        assertThat(asignado.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
    }

    @Test
    void escalarSoloEnSolicitadoYSubeRadioYVentana() {
        RequerimientoInsumo requerimiento = crearConRadio();
        Instant nuevaVentana = AHORA.plusSeconds(450);

        requerimiento.escalar(15.0, nuevaVentana);

        assertThat(requerimiento.getRadioKm()).isEqualTo(15.0);
        assertThat(requerimiento.getVentanaExpiraEn()).isEqualTo(nuevaVentana);

        requerimiento.asignar(20, 3.0, AHORA);
        assertThatThrownBy(() -> requerimiento.escalar(20.0, nuevaVentana.plusSeconds(10)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void crearConRadioGuardaDestinoRadioYVentana() {
        RequerimientoInsumo requerimiento = crearConRadio();

        assertThat(requerimiento.getDestino()).isEqualTo(new Point(4.65, -74.1));
        assertThat(requerimiento.getRadioKm()).isEqualTo(10.0);
        assertThat(requerimiento.getVentanaExpiraEn()).isEqualTo(AHORA.plusSeconds(225));
        assertThat(requerimiento.getEtaMinutos()).isNull();
    }

    @Test
    void unRequerimientoLegadoSinRadioSigueSiendoValido() {
        RequerimientoInsumo legado = crear();

        assertThat(legado.getRadioKm()).isNull();
        assertThat(legado.getDestino()).isNull();
        assertThat(legado.getVentanaExpiraEn()).isNull();
        assertThat(legado.estaVigente(AHORA)).isTrue();
    }

    @Test
    void marcarEtaAvisadoRegistraElMomento() {
        RequerimientoInsumo requerimiento = crearConRadio();
        requerimiento.asignar(10, 2.0, AHORA);

        requerimiento.marcarEtaAvisado(AHORA.plusSeconds(700));

        assertThat(requerimiento.getEtaAvisoEn()).isEqualTo(AHORA.plusSeconds(700));
    }

    private RequerimientoInsumo crearConRadio() {
        return RequerimientoInsumo.crear(UUID.randomUUID(), UUID.randomUUID(), lineas(), "obs", AHORA, EXPIRA,
                new Point(4.65, -74.1), 10.0, AHORA.plusSeconds(225));
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
