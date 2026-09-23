package com.sena.cold_day.core.modules.proveedores.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.sena.cold_day.core.modules.proveedores.domain.aggregates.RequerimientoInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.entities.OfertaInsumo;
import com.sena.cold_day.core.modules.proveedores.domain.repository.OfertaInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.repository.RequerimientoInsumoRepository;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.EstadoRequerimiento;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.InsumoLinea;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoEstado;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.OfertaInsumoId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.ProveedorId;
import com.sena.cold_day.core.modules.proveedores.domain.valueobjects.RequerimientoInsumoId;

/**
 * Authoritative proof of the exactly-one-winner invariant for insumo dispatch
 * (spec disp.R3, design AD6). Two suppliers accept the same request from two
 * threads released together by a {@link CountDownLatch}; the conditional bulk
 * UPDATE on the request root must let exactly one win, bind that supplier's
 * offer as {@code ACEPTADA} and invalidate the sibling as {@code CANCELADA}.
 *
 * <p>The request window is derived from the injected real {@link Clock}, never
 * from a hardcoded past instant: a past {@code expira_en} would be swept to
 * {@code SIN_PROVEEDOR} by a sibling cached context's scheduler and both accept
 * threads would read zero rows. The {@code test} task also pushes every sweep
 * delay out of the test window (see build.gradle), so the proof is reproducible
 * in a full-suite run, not only in isolation.
 */
@SpringBootTest
@TestPropertySource(properties = "app.insumos.barrido-ms=3600000")
class RequerimientoInsumoConcurrenteIT {

    private static final UUID OT_ID = UUID.randomUUID();
    private static final UUID TECNICO_ID = UUID.randomUUID();

    @Autowired Clock clock;
    @Autowired RequerimientoInsumoRepository requerimientos;
    @Autowired OfertaInsumoRepository ofertas;
    @Autowired SpringDataRequerimientoInsumoRepository springDataRequerimientos;
    @Autowired SpringDataOfertaInsumoRepository springDataOfertas;

    private Instant ahora;

    @BeforeEach
    void usarRelojReal() {
        ahora = clock.instant();
    }

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataRequerimientos.deleteAll();
    }

    @Test
    void twoSimultaneousAcceptsResolveToExactlyOneWinner() throws Exception {
        RequerimientoInsumo req = requerimientos.save(RequerimientoInsumo.crear(OT_ID, TECNICO_ID,
                List.of(new InsumoLinea("Filtro secadora", 1)), null, ahora, ahora.plusSeconds(600)));
        OfertaInsumo primero = ofertas.save(
                OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), ahora, ahora.plusSeconds(600)));
        OfertaInsumo segundo = ofertas.save(
                OfertaInsumo.crear(req.getId(), ProveedorId.nueva(), ahora, ahora.plusSeconds(600)));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch listos = new CountDownLatch(2);
        CountDownLatch disparar = new CountDownLatch(1);
        try {
            Future<Integer> corridaPrimero = pool.submit(
                    () -> aceptarCuandoSuene(primero.getId(), req.getId(), listos, disparar));
            Future<Integer> corridaSegundo = pool.submit(
                    () -> aceptarCuandoSuene(segundo.getId(), req.getId(), listos, disparar));
            assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
            disparar.countDown();
            int ganadorPrimero = corridaPrimero.get(15, TimeUnit.SECONDS);
            int ganadorSegundo = corridaSegundo.get(15, TimeUnit.SECONDS);
            assertThat(ganadorPrimero + ganadorSegundo).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        assertThat(requerimientos.buscarPorId(req.getId())).hasValueSatisfying(found ->
                assertThat(found.getEstado()).isEqualTo(EstadoRequerimiento.ASIGNADO));

        long aceptadas = contarEstado(primero.getId(), segundo.getId(), OfertaInsumoEstado.ACEPTADA);
        long canceladas = contarEstado(primero.getId(), segundo.getId(), OfertaInsumoEstado.CANCELADA);
        assertThat(aceptadas).isEqualTo(1);
        assertThat(canceladas).isEqualTo(1);
    }

    /** Releases both threads together, then runs the two-level conditional accept gate. */
    private int aceptarCuandoSuene(OfertaInsumoId ofertaId, RequerimientoInsumoId requerimientoId,
            CountDownLatch listos, CountDownLatch disparar) throws InterruptedException {
        listos.countDown();
        disparar.await(10, TimeUnit.SECONDS);
        int gano = requerimientos.intentarAsignar(requerimientoId, ahora);
        if (gano == 1) {
            ofertas.intentarAceptar(ofertaId, ahora);
            ofertas.invalidarPendientesDe(requerimientoId, OfertaInsumoEstado.CANCELADA, ahora);
        }
        return gano;
    }

    private long contarEstado(OfertaInsumoId primero, OfertaInsumoId segundo, OfertaInsumoEstado estado) {
        return Stream.of(primero, segundo)
                .map(id -> ofertas.buscarPorId(id).orElseThrow())
                .filter(oferta -> oferta.getEstado() == estado)
                .count();
    }
}
