package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.IncumplimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.IncumplimientoInsumoRepositoryAdapter;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.OfertaInsumoRepositoryAdapter;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.RequerimientoInsumoRepositoryAdapter;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.support.FkFixtures;

/** Operaciones condicionales del cambio de proveedor (diseno 2026-11-26, ETA incumplido). */
@DataJpaTest
@Import({RequerimientoInsumoRepositoryAdapter.class, OfertaInsumoRepositoryAdapter.class,
        IncumplimientoInsumoRepositoryAdapter.class})
class CambioProveedorRepositoryIT {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final Instant NUEVA_EXPIRA = AHORA.plusSeconds(900);
    private static final Instant NUEVA_VENTANA = AHORA.plusSeconds(225);

    @Autowired JdbcTemplate jdbc;
    @Autowired RequerimientoInsumoRepositoryAdapter requerimientos;
    @Autowired OfertaInsumoRepositoryAdapter ofertas;
    @Autowired IncumplimientoInsumoRepositoryAdapter incumplimientos;

    private FkFixtures fx;
    private UUID otId;
    private UUID tecnicoId;
    private ProveedorId a;
    private ProveedorId b;
    private ProveedorId c;

    @BeforeEach
    void setUp() {
        fx = new FkFixtures(jdbc);
        jdbc.update("DELETE FROM incumplimiento_insumo");
        jdbc.update("DELETE FROM oferta_insumo");
        otId = fx.ot(UUID.randomUUID());
        tecnicoId = fx.tecnico(UUID.randomUUID());
        a = ProveedorId.desde(fx.proveedor(UUID.randomUUID()));
        b = ProveedorId.desde(fx.proveedor(UUID.randomUUID()));
        c = ProveedorId.desde(fx.proveedor(UUID.randomUUID()));
    }

    @Test
    void noReabreAntesDeVencer() {
        RequerimientoInsumoId id = asignado(30, AHORA.minusSeconds(29 * 60));

        assertThat(reabrir(id, tecnicoId)).isZero();

        assertThat(requerimientos.buscarPorId(id).orElseThrow().getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO);
    }

    @Test
    void reabreVencidoConVigenciaNueva() {
        RequerimientoInsumoId id = asignado(30, AHORA.minusSeconds(30 * 60));

        assertThat(reabrir(id, tecnicoId)).isEqualTo(1);

        RequerimientoInsumo reabierto = requerimientos.buscarPorId(id).orElseThrow();
        assertThat(reabierto.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
        assertThat(reabierto.getExpiraEn()).isEqualTo(NUEVA_EXPIRA);
        assertThat(reabierto.getRadioKm()).isEqualTo(10.0);
        assertThat(reabierto.getVentanaExpiraEn()).isEqualTo(NUEVA_VENTANA);
        assertThat(reabierto.getEtaMinutos()).isNull();
        assertThat(reabierto.getDistanciaKm()).isNull();
        assertThat(reabierto.getAceptadaEn()).isNull();
        assertThat(reabierto.getEtaAvisoEn()).isNull();
    }

    @Test
    void noReabreDeOtroTecnicoNiDespachado() {
        RequerimientoInsumoId ajeno = asignado(30, AHORA.minusSeconds(3600));
        assertThat(reabrir(ajeno, UUID.randomUUID())).isZero();

        RequerimientoInsumoId despachado = asignado(30, AHORA.minusSeconds(3600));
        jdbc.update("UPDATE requerimiento_insumo SET estado = 'DESPACHADO' WHERE id = ?", despachado.valor());
        assertThat(reabrir(despachado, tecnicoId)).isZero();
    }

    @Test
    void soloDespachaElProveedorConLaOfertaAceptada() {
        RequerimientoInsumoId id = asignado(30, AHORA.minusSeconds(60));
        oferta(id, a, OfertaInsumoEstado.ACEPTADA);
        assertThat(ofertas.reemplazarAceptada(id, a, AHORA)).isEqualTo(1);
        oferta(id, b, OfertaInsumoEstado.ACEPTADA);

        assertThat(requerimientos.despacharSiAsignado(id, a, AHORA)).isZero();
        assertThat(requerimientos.despacharSiAsignado(id, b, AHORA)).isEqualTo(1);

        RequerimientoInsumo despachado = requerimientos.buscarPorId(id).orElseThrow();
        assertThat(despachado.getEstado()).isEqualTo(EstadoRequerimiento.DESPACHADO);
        assertThat(despachado.getDespachadaEn()).isEqualTo(AHORA);
    }

    @Test
    void vuelveAOfrecerACanceladosPeroNoAReemplazadoNiRechazado() {
        RequerimientoInsumoId id = asignado(30, AHORA.minusSeconds(3600));
        oferta(id, a, OfertaInsumoEstado.ACEPTADA);
        oferta(id, b, OfertaInsumoEstado.RECHAZADO);
        oferta(id, c, OfertaInsumoEstado.CANCELADA);

        assertThat(ofertas.fueReemplazado(id, a)).isFalse();
        assertThat(ofertas.buscarAceptada(id)).map(OfertaInsumo::getProveedorId).contains(a);
        ofertas.reemplazarAceptada(id, a, AHORA);
        assertThat(ofertas.buscarAceptada(id)).isEmpty();

        assertThat(ofertas.fueReemplazado(id, a)).isTrue();
        assertThat(ofertas.proveedoresOfertados(id)).containsExactlyInAnyOrder(a, b);
    }

    @Test
    void guardaYListaIncumplimientosRecientesPrimero() {
        RequerimientoInsumoId id = asignado(30, AHORA.minusSeconds(3600));
        incumplimientos.guardar(new IncumplimientoInsumo(UUID.randomUUID(), id, a, 30,
                AHORA.minusSeconds(7200), AHORA.minusSeconds(600)));
        incumplimientos.guardar(new IncumplimientoInsumo(UUID.randomUUID(), id, b, 45,
                AHORA.minusSeconds(3600), AHORA));

        assertThat(incumplimientos.recientes()).extracting(IncumplimientoInsumo::proveedorId)
                .containsExactly(b, a);
        assertThat(incumplimientos.recientes().get(0).etaMinutos()).isEqualTo(45);
    }

    private int reabrir(RequerimientoInsumoId id, UUID tecnico) {
        return requerimientos.reabrirSiEtaVencido(id, tecnico, AHORA, NUEVA_EXPIRA, 10.0, NUEVA_VENTANA);
    }

    private RequerimientoInsumoId asignado(int etaMinutos, Instant aceptadaEn) {
        RequerimientoInsumo requerimiento = requerimientos.save(RequerimientoInsumo.crear(otId, tecnicoId,
                List.of(new InsumoLinea("Filtro", 1)), null, AHORA.minusSeconds(7200), AHORA.minusSeconds(6300),
                new Point(4.65, -74.1), 25.0, AHORA.minusSeconds(6900)));
        requerimiento.asignar(etaMinutos, 5.0, aceptadaEn);
        requerimiento.marcarEtaAvisado(AHORA.minusSeconds(1));
        return requerimientos.save(requerimiento).getId();
    }

    private void oferta(RequerimientoInsumoId id, ProveedorId proveedor, OfertaInsumoEstado estado) {
        OfertaInsumo creada = OfertaInsumo.crear(id, proveedor, AHORA.minusSeconds(7200), NUEVA_EXPIRA);
        ofertas.save(OfertaInsumo.reconstituir(creada.getId(), id, proveedor, estado, creada.getCreadaEn(),
                creada.getExpiraEn(), null));
    }
}
