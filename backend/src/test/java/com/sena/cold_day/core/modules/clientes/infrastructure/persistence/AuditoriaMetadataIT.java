package com.sena.cold_day.core.modules.clientes.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.dto.OtRequest;
import com.sena.cold_day.core.modules.ot.application.usecases.CrearOtUseCase;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.support.FkFixtures;

/**
 * Audit metadata IT for spec R1/R2/R3/R6.
 *
 * <p>Audit columns are read with native SQL through {@link JdbcTemplate}
 * because audit metadata is persistence-layer only: no API response exposes it
 * and no domain object carries it.
 *
 * <p>No test here asserts an exact audit instant. Audit time comes from Spring's
 * {@code DateTimeProvider}, which is non-deterministic by design and is
 * deliberately NOT the {@link Clock} bean. Assertions are limited to non-null,
 * ordering, and equality of {@code created_at} across an update.
 *
 * <p>The last two tests are the business-timestamp guard (R6) and are the
 * highest-value ones in this file: they fail if anybody ever annotates
 * {@code ot.creada_en}, {@code proveedor.creado_en} or
 * {@code tecnico.ubicacion_actualizada_en} with {@code @CreatedDate} /
 * {@code @LastModifiedDate}.
 */
@SpringBootTest
@Import(AuditoriaMetadataIT.RelojFijoConfig.class)
class AuditoriaMetadataIT {

    /** Far enough from "now" that it can never collide with an audit instant. */
    private static final Instant NEGOCIO_FIJO = Instant.parse("2020-03-04T05:06:07Z");

    private static final Point BOGOTA = new Point(4.7110, -74.0721);

    @Autowired JdbcTemplate jdbc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ProveedorRepository proveedorRepository;
    @Autowired OtRepository otRepository;
    @Autowired CrearOtUseCase crearOt;

    /** FkFixtures is a plain helper over JdbcTemplate, not a Spring bean. */
    private FkFixtures fk;

    @BeforeEach
    void setUp() {
        fk = new FkFixtures(jdbc);
    }

    // --------------------------------------------------------------- R2 / R3 --

    @Test
    void clienteAuditoriaSeEscribeAlInsertarYSeRefrescaAlActualizar() {
        Cliente cliente = clienteRepository.save(nuevoCliente("Calle 1"));

        UUID id = cliente.getId().valor();
        AuditRow trasInsert = leerCliente(id);

        assertThat(trasInsert.createdAt()).isNotNull();
        assertThat(trasInsert.updatedAt()).isNotNull();
        assertThat(trasInsert.updatedAt()).isAfterOrEqualTo(trasInsert.createdAt());
        // No principal exists in this test context, so the sentinel is stored.
        assertThat(trasInsert.createdBy()).isEqualTo("system");
        assertThat(trasInsert.lastModifiedBy()).isEqualTo("system");

        cliente.actualizarDireccion(DireccionPrincipal.sinUbicacion("Calle 2", "Bogota", "Centro"));
        clienteRepository.save(cliente);

        AuditRow trasUpdate = leerCliente(id);

        assertThat(trasUpdate.createdAt()).isEqualTo(trasInsert.createdAt());
        assertThat(trasUpdate.updatedAt()).isAfter(trasInsert.updatedAt());
        assertThat(trasUpdate.createdBy()).isEqualTo(trasInsert.createdBy());
        assertThat(trasUpdate.lastModifiedBy()).isEqualTo("system");
    }

    @Test
    void lasCuatroTablasGuardanAuditoriaNoNula() {
        Cliente cliente = clienteRepository.save(nuevoCliente("Calle 1"));
        Tecnico tecnico = tecnicoRepository.save(Tecnico.crear(fk.usuario("TECNICO"),
                "CC-" + UUID.randomUUID(), Set.of(CategoriaServicio.REFRIGERACION), Set.of()));
        Proveedor proveedor = proveedorRepository.save(Proveedor.crear(fk.usuario("PROVEEDOR"),
                "Auditoria SAS", "NIT-" + UUID.randomUUID(), null, null, null, Set.of()));

        // Through the real use case, so creadaEn is fed by the fixed Clock.
        crearOt.crear(pedidoOt(), cliente.getUsuarioId());
        UUID otId = otRepository.buscarPorCliente(cliente.getId()).get(0).getId().valor();

        assertThat(leerCliente(cliente.getId().valor()).createdAt()).isNotNull();
        assertThat(leerTecnico(tecnico.getId().valor()).createdAt()).isNotNull();
        assertThat(leerProveedor(proveedor.getId().valor()).createdAt()).isNotNull();

        AuditRow ot = leerOt(otId);
        assertThat(ot.createdAt()).isNotNull();
        assertThat(ot.updatedAt()).isAfterOrEqualTo(ot.createdAt());
        assertThat(ot.createdBy()).isEqualTo("system");
        assertThat(ot.lastModifiedBy()).isEqualTo("system");
    }

    // ------------------------------------------------------ R6 business guard --

    @Test
    void creadaEnVieneDelClockDeNegocioYCreatedAtEsUnInstanteDeAuditoriaIndependiente() {
        Cliente cliente = clienteRepository.save(nuevoCliente("Calle 1"));
        crearOt.crear(pedidoOt(), cliente.getUsuarioId());

        var ot = otRepository.buscarPorCliente(cliente.getId()).get(0);

        assertThat(ot.getCreadaEn()).isEqualTo(NEGOCIO_FIJO);

        AuditRow row = leerOt(ot.getId().valor());
        assertThat(row.createdAt()).isNotNull();
        // The audit DateTimeProvider is NOT the Clock: a fixed business clock can
        // never leak into created_at.
        assertThat(row.createdAt()).isNotEqualTo(NEGOCIO_FIJO);
        assertThat(row.createdAt()).isAfter(NEGOCIO_FIJO);
    }

    @Test
    void creadoEnYUbicacionActualizadaEnSiguenSiendoTiemposDeNegocio() {
        Proveedor proveedor = proveedorRepository.save(Proveedor.crear(fk.usuario("PROVEEDOR"),
                "Negocio SAS", "NIT-" + UUID.randomUUID(), null, null, null, Set.of()));
        Instant creadoEnDelDominio = proveedor.getCreadoEn();
        proveedorRepository.save(proveedor);

        // Proveedor.crear uses Instant.now(), which carries nanoseconds while
        // timestamptz(6) stores microseconds and rounds. The business instant is
        // preserved up to the precision the column actually keeps; the point of
        // the assertion is that auditing did NOT overwrite it, which would show
        // up as a completely different value.
        assertThat(leerInstante("proveedor", "creado_en", proveedor.getId().valor()))
                .isCloseTo(creadoEnDelDominio, within(1, ChronoUnit.MICROS));
        assertThat(leerProveedor(proveedor.getId().valor()).createdAt()).isNotNull();

        // The technician moves: only that operation sets ubicacion_actualizada_en,
        // and updated_at remains a completely separate audit value.
        Tecnico tecnico = tecnicoRepository.save(Tecnico.crear(fk.usuario("TECNICO"),
                "CC-" + UUID.randomUUID(), Set.of(CategoriaServicio.REFRIGERACION), Set.of()));
        Instant instanteDelNegocio = Instant.parse("2019-07-08T09:10:11Z");
        tecnico.actualizarUbicacion(BOGOTA, instanteDelNegocio);
        tecnicoRepository.save(tecnico);

        assertThat(leerInstante("tecnico", "ubicacion_actualizada_en", tecnico.getId().valor()))
                .isEqualTo(instanteDelNegocio);
        assertThat(leerTecnico(tecnico.getId().valor()).updatedAt()).isNotEqualTo(instanteDelNegocio);
    }

    // ---------------------------------------------------------------- helpers --

    private Cliente nuevoCliente(String calle) {
        return Cliente.registrar(new UsuarioId(fk.usuario("CLIENTE")), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion(calle, "Bogota", "Centro"));
    }

    private OtRequest pedidoOt() {
        return new OtRequest(CategoriaServicio.REFRIGERACION, "No enfria", List.of(), "Calle 1", BOGOTA);
    }

    private record AuditRow(Instant createdAt, Instant updatedAt, String createdBy, String lastModifiedBy) {}

    private static final String SELECT_AUDITORIA =
            "SELECT created_at, updated_at, created_by, last_modified_by FROM %s WHERE id = ?";

    private AuditRow leer(String tabla, UUID id) {
        return jdbc.queryForObject(String.format(SELECT_AUDITORIA, tabla), (rs, n) -> new AuditRow(
                instante(rs, "created_at"), instante(rs, "updated_at"),
                rs.getString("created_by"), rs.getString("last_modified_by")), id);
    }

    private AuditRow leerCliente(UUID id) { return leer("clientes", id); }
    private AuditRow leerTecnico(UUID id) { return leer("tecnico", id); }
    private AuditRow leerOt(UUID id) { return leer("ot", id); }
    private AuditRow leerProveedor(UUID id) { return leer("proveedor", id); }

    private Instant leerInstante(String tabla, String columna, UUID id) {
        return jdbc.queryForObject("SELECT " + columna + " FROM " + tabla + " WHERE id = ?",
                (rs, n) -> instante(rs, columna), id);
    }

    private static Instant instante(ResultSet rs, String columna) throws SQLException {
        OffsetDateTime value = rs.getObject(columna, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    /**
     * Test-scoped fixed Clock. It proves the two clocks are independent: business
     * timestamps follow this bean, audit timestamps follow Spring's
     * DateTimeProvider and are therefore unaffected by it. No production wiring
     * changes because of this class.
     */
    @TestConfiguration
    static class RelojFijoConfig {

        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(NEGOCIO_FIJO, ZoneOffset.UTC);
        }
    }
}
