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

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.OfertaInsumoRepositoryAdapter;
import com.sena.cold_day.core.modules.proveedores.infrastructure.repository.RequerimientoInsumoRepositoryAdapter;

/**
 * Persistence boundary for the three dispatch tables (spec disp.R3/R4/R5/R7,
 * design AD5/AD6): the request root with its immutable lines, the per-offer
 * server-authoritative expiry, the atomic first-accept gates and the append-only
 * per-offer resolution states that must survive a reload.
 */
@DataJpaTest
@Import({RequerimientoInsumoRepositoryAdapter.class, OfertaInsumoRepositoryAdapter.class})
class RequerimientoInsumoRepositoryTest {

    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");
    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();

    @Autowired RequerimientoInsumoRepositoryAdapter requerimientos;
    @Autowired OfertaInsumoRepositoryAdapter ofertas;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;

    @BeforeEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
    }

    @Test
    void savesAndFindsRequestWithItsImmutableItems() {
        RequerimientoInsumo saved = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));

        assertThat(requerimientos.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO);
            assertThat(found.getOtId()).isEqualTo(OT_ID);
            assertThat(found.getTecnicoId()).isEqualTo(TECNICO_ID);
            assertThat(found.getObservaciones()).isEqualTo("Compresor ruidoso");
            assertThat(found.getExpiraEn()).isEqualTo(AHORA.plusSeconds(600));
            assertThat(found.getItems()).singleElement().satisfies(item -> {
                assertThat(item.getId()).isNotNull();
                assertThat(item.getDescripcion()).isEqualTo("Filtro secadora");
                assertThat(item.getCantidad()).isEqualTo(2);
            });
        });
    }

    @Test
    void asignarSiDisponibleWinsOnlyOnce() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));

        int ganador = requerimientos.intentarAsignar(req.getId(), AHORA);
        int repetido = requerimientos.intentarAsignar(req.getId(), AHORA);

        assertThat(ganador).isEqualTo(1);
        assertThat(repetido).isZero();
        assertThat(requerimientos.buscarPorId(req.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO));
    }

    @Test
    void asignarSiDisponibleRejectsAnExpiredRequest() {
        RequerimientoInsumo req = requerimientos.save(
                crearRequerimiento(AHORA.minusSeconds(10), AHORA.minusSeconds(1)));

        assertThat(requerimientos.intentarAsignar(req.getId(), AHORA)).isZero();
        assertThat(requerimientos.buscarPorId(req.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
    }

    @Test
    void expirarVencidosResolvesOnlyExpiredOpenRequests() {
        RequerimientoInsumo vencido = requerimientos.save(
                crearRequerimiento(AHORA.minusSeconds(10), AHORA.minusSeconds(1)));
        RequerimientoInsumo vigente = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));

        assertThat(requerimientos.expirarVencidos(AHORA)).isEqualTo(1);
        assertThat(requerimientos.buscarPorId(vencido.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SIN_PROVEEDOR);
            assertThat(found.getResueltaEn()).isEqualTo(AHORA);
        });
        assertThat(requerimientos.buscarPorId(vigente.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.SOLICITADO));
    }

    @Test
    void persistsOfferWithItsServerAuthoritativeExpiry() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        ProveedorId proveedorId = ProveedorId.nueva();
        OfertaInsumo saved = ofertas.save(
                OfertaInsumo.crear(req.getId(), proveedorId, AHORA, AHORA.plusSeconds(600)));

        assertThat(ofertas.buscarPorId(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE);
            assertThat(found.getRequerimientoId()).isEqualTo(req.getId());
            assertThat(found.getProveedorId()).isEqualTo(proveedorId);
            assertThat(found.getExpiraEn()).isEqualTo(AHORA.plusSeconds(600));
            assertThat(found.getResueltaEn()).isNull();
        });
    }

    @Test
    void intentarAceptarWinsOnlyWhilePendingAndVigente() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo oferta = ofertas.save(
                OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), AHORA, AHORA.plusSeconds(600)));

        int ganador = ofertas.intentarAceptar(oferta.getId(), AHORA);
        int repetido = ofertas.intentarAceptar(oferta.getId(), AHORA);
        OfertaInsumo vencida = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.PENDIENTE, AHORA.minusSeconds(10), AHORA.minusSeconds(1),
                null));

        assertThat(ganador).isEqualTo(1);
        assertThat(repetido).isZero();
        assertThat(ofertas.intentarAceptar(vencida.getId(), AHORA)).isZero();
        assertThat(ofertas.buscarPorId(oferta.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.ACEPTADA);
            assertThat(found.getResueltaEn()).isEqualTo(AHORA);
        });
    }

    @Test
    void invalidarPendientesDeCancelsOnlyTheSiblingsOfTheRequest() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        RequerimientoInsumo otro = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo uno = ofertas.save(OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo dos = ofertas.save(OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo ajeno = ofertas.save(OfertaInsumo.crear(otro.getId(), ProveedorId.nueva(), AHORA, AHORA.plusSeconds(600)));

        ofertas.invalidarPendientesDe(req.getId(), OfertaInsumoEstado.CANCELADA, AHORA);

        assertThat(ofertas.buscarPorId(uno.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));
        assertThat(ofertas.buscarPorId(dos.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));
        assertThat(ofertas.buscarPorId(ajeno.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE));
    }

    @Test
    void expirarVencidasClosesOnlyExpiredPendingOffers() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo vencida = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.PENDIENTE, AHORA.minusSeconds(10), AHORA.minusSeconds(1),
                null));
        OfertaInsumo vigente = ofertas.save(OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo aceptada = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.ACEPTADA, AHORA, AHORA.plusSeconds(600), AHORA));

        assertThat(ofertas.expirarVencidas(AHORA)).isEqualTo(1);
        assertThat(ofertas.buscarPorId(vencida.getId())).hasValueSatisfying(found -> {
            assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA);
            assertThat(found.getResueltaEn()).isEqualTo(AHORA);
        });
        assertThat(ofertas.buscarPorId(vigente.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.PENDIENTE));
        assertThat(ofertas.buscarPorId(aceptada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.ACEPTADA));
    }

    @Test
    void persistsTheAppendOnlyPerOfferResolutionStates() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        OfertaInsumo rechazada = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.RECHAZADO, AHORA, AHORA.plusSeconds(600), AHORA));
        OfertaInsumo expirada = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.EXPIRADA, AHORA, AHORA.minusSeconds(1), AHORA));
        OfertaInsumo cancelada = ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(),
                ProveedorId.nueva(), OfertaInsumoEstado.CANCELADA, AHORA, AHORA.plusSeconds(600), AHORA));

        assertThat(ofertas.buscarPorId(rechazada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.RECHAZADO));
        assertThat(ofertas.buscarPorId(expirada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.EXPIRADA));
        assertThat(ofertas.buscarPorId(cancelada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaInsumoEstado.CANCELADA));
    }

    @Test
    void listsPendingOffersOfARequestOldestFirst() {
        RequerimientoInsumo req = requerimientos.save(crearRequerimiento(AHORA, AHORA.plusSeconds(600)));
        ofertas.save(OfertaInsumo.reconstituir(OfertaInsumoId.nueva(), req.getId(), ProveedorId.nueva(),
                OfertaInsumoEstado.ACEPTADA, AHORA, AHORA.plusSeconds(600), AHORA));
        OfertaInsumo pendiente = ofertas.save(
                OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), AHORA.plusSeconds(5), AHORA.plusSeconds(600)));

        assertThat(ofertas.listarPendientesPorRequerimiento(req.getId()))
                .singleElement()
                .satisfies(found -> assertThat(found.getId()).isEqualTo(pendiente.getId()));
    }

    private RequerimientoInsumo crearRequerimiento(Instant creadaEn, Instant expiraEn) {
        return RequerimientoInsumo.crear(OT_ID, TECNICO_ID, List.of(new InsumoLinea("Filtro secadora", 2)),
                "Compresor ruidoso", creadaEn, expiraEn);
    }
}
