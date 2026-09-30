package com.sena.cold_day.core.shared.infrastructure.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.usecases.LimpiarOrdenesHuerfanasUseCase;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.proveedores.domain.aggregates.Proveedor;
import com.sena.cold_day.core.modules.proveedores.domain.repository.ProveedorRepository;
import com.sena.cold_day.core.modules.tecnicos.application.usecases.ReconciliarTecnicosOcupadosUseCase;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.support.FkFixtures;

/**
 * Spec R5 end-to-end coverage: every write path that runs with NO authenticated
 * principal must store the literal {@code "system"} and must not throw.
 *
 * <p>These four paths are not hypothetical in this codebase — they are the
 * normal way a large share of rows get written, which is precisely why
 * {@code AuditoriaConfig} treats {@code "system"} as a behavioral contract and
 * not as a fallback of convenience.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuditoriaSinPrincipalIT {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ProveedorRepository proveedorRepository;
    @Autowired OtRepository otRepository;
    @Autowired LimpiarOrdenesHuerfanasUseCase limpiarOrdenesHuerfanas;
    @Autowired ReconciliarTecnicosOcupadosUseCase reconciliarTecnicos;

    private FkFixtures fk;

    @BeforeEach
    void setUp() {
        fk = new FkFixtures(jdbc);
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------ (a) public client signup --

    @Test
    void elRegistroPublicoDeClienteGuardaSystemComoAuditor() throws Exception {
        mockMvc.perform(post("/api/clientes").contentType(MediaType.APPLICATION_JSON).content(
                        "{\"nombre\":\"Ana\",\"correo\":\"auditoria-cliente@example.com\",\"password\":\"secreto\","
                                + "\"tipoCliente\":\"B2C\",\"calle\":\"Calle 1\",\"ciudad\":\"Bogota\","
                                + "\"aceptaHabeasData\":true}"))
                .andExpect(status().isCreated());

        assertThat(auditorUnico("clientes")).isEqualTo("system");
    }

    // --------------------------------------------- (b) public technician signup --

    @Test
    void elRegistroPublicoDeTecnicoGuardaSystemComoAuditor() throws Exception {
        mockMvc.perform(post("/api/tecnicos").contentType(MediaType.APPLICATION_JSON).content(
                        "{\"numeroIdentificacion\":\"CC-%s\",\"nombre\":\"Luis\",\"correo\":\"auditoria-tecnico@example.com\","
                                + "\"password\":\"secreto\",\"categoriasServicio\":[\"REFRIGERACION\"],"
                                + "\"aceptaHabeasData\":true}".formatted(UUID.randomUUID())))
                .andExpect(status().isCreated());

        assertThat(auditorUnico("tecnico")).isEqualTo("system");
    }

    // --------------------------------------------- (c) scheduler-shaped writes --

    @Test
    void elJobQueCancelaOtHuerfanasEscribeEnLaTablaOtComoSystem() {
        UUID otId = crearOtBuscando();
        // An ASIGNADA order with no technician is the orphan the sweep cancels.
        jdbc.update("UPDATE ot SET estado = 'ASIGNADA', tecnico_id = NULL WHERE id = ?", otId);

        assertThatCode(limpiarOrdenesHuerfanas::ejecutar).doesNotThrowAnyException();

        assertThat(estado(otId)).isEqualTo("CANCELADA");
        assertThat(auditorUnicoEn("ot", "last_modified_by")).isEqualTo("system");
    }

    @Test
    void elJobQueLiberaTecnicosOcupadosEscribeEnLaTablaTecnicoComoSystem() {
        UUID tecnicoId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO tecnico (id, usuario_id, numero_identificacion, estado_operativo,
                                     estado_validacion, activo, tracking_activo)
                VALUES (?, ?, ?, 'OCUPADO', 'APROBADO', true, false)
                """, tecnicoId, fk.usuario("TECNICO"), "OC-" + tecnicoId);

        assertThatCode(reconciliarTecnicos::ejecutar).doesNotThrowAnyException();

        assertThat(auditorUnicoEn("tecnico", "last_modified_by")).isEqualTo("system");
    }

    // ------------------------------------------------ (d) seeder-shaped writes --

    @Test
    void lasEscriturasConFormaDeSeederGuardanSystemComoAuditor() {
        clienteRepository.save(Cliente.registrar(new UsuarioId(fk.usuario("CLIENTE")), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
        tecnicoRepository.save(Tecnico.crear(fk.usuario("TECNICO"), "SD-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of()));
        proveedorRepository.save(Proveedor.crear(fk.usuario("PROVEEDOR"), "Seeder SAS",
                "NIT-" + UUID.randomUUID(), null, null, null, Set.of()));

        assertThat(auditorUnico("clientes")).isEqualTo("system");
        assertThat(auditorUnico("tecnico")).isEqualTo("system");
        assertThat(auditorUnico("proveedor")).isEqualTo("system");
    }

    // ---------------------------------------------------------------- helpers --

    /** The single distinct value stored in the given auditor column. */
    private String auditorUnico(String tabla) {
        return auditorUnicoEn(tabla, "created_by");
    }

    /**
     * The sweep and the reconciliation fixtures create their rows with raw SQL,
     * so only {@code last_modified_by} is written by the entity lifecycle —
     * that is the column this test asserts on for those two paths.
     */
    private String auditorUnicoEn(String tabla, String columna) {
        return jdbc.queryForObject(
                "SELECT DISTINCT " + columna + " FROM " + tabla, (rs, n) -> rs.getString(1));
    }

    private String estado(UUID otId) {
        return jdbc.queryForObject("SELECT estado FROM ot WHERE id = ?",
                (rs, n) -> rs.getString(1), otId);
    }

    private UUID crearOtBuscando() {
        UUID clienteId = fk.cliente(UUID.randomUUID());
        UUID otId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO ot (id, cliente_id, categoria_servicio, descripcion_falla, direccion,
                                latitud, longitud, estado, radio_km, ventana_expira_en, creada_en,
                                auxiliares_requeridos, version)
                VALUES (?, ?, 'REFRIGERACION', 'No enfria', 'Calle 1', 4.7110, -74.0721,
                        'BUSCANDO_TECNICO', 10.0, ?, ?, 0, 0)
                """, otId, clienteId,
                // OffsetDateTime, not Instant: the PostgreSQL driver cannot infer a
                // SQL type for a raw java.time.Instant parameter.
                OffsetDateTime.parse("2099-01-01T00:00:00Z"),
                OffsetDateTime.now(ZoneOffset.UTC));
        return otId;
    }
}
