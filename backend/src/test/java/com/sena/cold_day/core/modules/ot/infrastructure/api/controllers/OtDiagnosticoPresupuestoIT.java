package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.Presupuesto;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.TarifaFuente;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.OtEstadoHistorialJpaEntity;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.SpringDataTecnicoRepository;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;

/**
 * End-to-end PR7 walk (task 7.8): create/dispatch-assigned OT -> EN_CAMINO ->
 * diagnosis + budget -> approval -> EN_REPARACION -> FINALIZADA, and the
 * rejection/cancellation variants. Every terminal path releases the assigned
 * technician back to DISPONIBLE.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.dispatch.escalamiento-ms=3600000")
class OtDiagnosticoPresupuestoIT {

    // Inside the metropolitan radius of the configured service center, so the
    // authoritative tariff is the flat base (30,000 COP) for every walk.
    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);
    private static final String DIAGNOSTICO_PAYLOAD = "{\"fallaDetectada\":\"Compresor averiado\","
            + "\"observaciones\":\"Revisado en sitio\",\"costoManoObra\":120000.00,\"costoRepuestos\":350000.00}";

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void walksFromAssignedToFinalizedAndReleasesTheTechnician() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-flujo@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-flujo@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otAsignada(cliente.getId(), tecnicoId, Instant.now());

        String clienteToken = jwt(clienteUsuario, Rol.CLIENTE);
        String tecnicoToken = jwt(tecnicoUsuario, Rol.TECNICO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/iniciar-desplazamiento")
                        .header("Authorization", "Bearer " + tecnicoToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_CAMINO"));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/diagnostico")
                        .header("Authorization", "Bearer " + tecnicoToken)
                        .contentType(MediaType.APPLICATION_JSON).content(DIAGNOSTICO_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_DIAGNOSTICO"))
                .andExpect(jsonPath("$.diagnostico.fallaDetectada").value("Compresor averiado"))
                .andExpect(jsonPath("$.presupuesto.costoManoObra").value(120000.00));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/presupuesto/aprobar")
                        .header("Authorization", "Bearer " + clienteToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_REPARACION"));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/finalizar")
                        .header("Authorization", "Bearer " + tecnicoToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("FINALIZADA"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.FINALIZADA);
                    assertThat(found.getDiagnostico().fallaDetectada()).isEqualTo("Compresor averiado");
                    assertThat(found.getPresupuesto().costoRepuestos()).isEqualByComparingTo("350000.00");
                });
        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .hasValueSatisfying(found -> assertThat(found.getEstadoOperativo())
                        .isEqualTo(EstadoOperativo.DISPONIBLE));
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor()))
                .extracting(OtEstadoHistorialJpaEntity::getEstadoDestino)
                .containsExactly(EstadoOt.EN_CAMINO, EstadoOt.EN_DIAGNOSTICO, EstadoOt.EN_REPARACION,
                        EstadoOt.FINALIZADA);
    }

    @Test
    void rejectingTheBudgetCancelsWithTheVisitFeeAndReleasesTheTechnician() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-rechaza@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-rechaza@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otEnDiagnostico(cliente.getId(), tecnicoId);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/presupuesto/rechazar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Muy costoso\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CANCELADA"))
                .andExpect(jsonPath("$.motivoCancelacion").value("RECHAZO_PRESUPUESTO"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.CANCELADA);
                    assertThat(found.getMotivoCancelacion()).isEqualTo(MotivoCancelacion.RECHAZO_PRESUPUESTO);
                    assertThat(found.getTarifaVisita()).isEqualByComparingTo("30000");
                    assertThat(found.getDistanciaKm()).isZero();
                    assertThat(found.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
                });
        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .hasValueSatisfying(found -> assertThat(found.getEstadoOperativo())
                        .isEqualTo(EstadoOperativo.DISPONIBLE));
    }

    @Test
    void cancellingOutsideTheFreeWindowChargesTheVisitFee() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-tarde@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-tarde@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otAsignada(cliente.getId(), tecnicoId, Instant.now().minus(Duration.ofMinutes(20)));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Ya no la necesito\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CANCELADA"))
                .andExpect(jsonPath("$.canceladaPor").value("CLIENTE"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getTarifaVisita()).isEqualByComparingTo("30000");
                    assertThat(found.getDistanciaKm()).isZero();
                    assertThat(found.getTarifaFuente()).isEqualTo(TarifaFuente.LINEAL);
                });
    }

    @Test
    void cancellingInsideTheFreeWindowHasNoVisitFee() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-temprano@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-temprano@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otAsignada(cliente.getId(), tecnicoId, Instant.now().minus(Duration.ofMinutes(1)));

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Me arrepenti\"}"))
                .andExpect(status().isOk());

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getTarifaVisita()).isNull());
    }

    @Test
    void cancellingWithoutAReasonIsRejectedAndLeavesTheStateUnchanged() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-sin-motivo@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-sin-motivo@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otAsignada(cliente.getId(), tecnicoId, Instant.now());

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.ASIGNADA));
    }

    @Test
    void cancellingOnceRepairStartedIsAConflict() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-reparacion@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-reparacion@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario, true);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_REPARACION, Instant.now(), null);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Ya no\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void aNonAssignedTechnicianCannotStartTheDisplacement() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-intruso@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long duenoUsuario = crearUsuario("tecnico-dueno-ot@example.com", Rol.TECNICO);
        TecnicoId dueno = crearTecnico(duenoUsuario, true);
        Long intrusoUsuario = crearUsuario("tecnico-intruso-ot@example.com", Rol.TECNICO);
        crearTecnico(intrusoUsuario, false);
        Ot ot = otAsignada(cliente.getId(), dueno, Instant.now());

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/iniciar-desplazamiento")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.TECNICO)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void rejectsUnauthenticatedDiagnosis() throws Exception {
        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/diagnostico")
                        .contentType(MediaType.APPLICATION_JSON).content(DIAGNOSTICO_PAYLOAD))
                .andExpect(status().isUnauthorized());
    }

    private Ot otAsignada(ClienteId clienteId, TecnicoId tecnicoId, Instant asignadaEn) {
        return otEnEstado(clienteId, tecnicoId, EstadoOt.ASIGNADA, asignadaEn, null);
    }

    private Ot otEnDiagnostico(ClienteId clienteId, TecnicoId tecnicoId) {
        Presupuesto presupuesto = new Presupuesto(new BigDecimal("120000.00"), new BigDecimal("350000.00"),
                Instant.now());
        return otEnEstado(clienteId, tecnicoId, EstadoOt.EN_DIAGNOSTICO, Instant.now(), presupuesto);
    }

    private Ot otEnEstado(ClienteId clienteId, TecnicoId tecnicoId, EstadoOt estado, Instant asignadaEn,
            Presupuesto presupuesto) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), asignadaEn, null, null, null, null, null,
                presupuesto);
        return otRepository.save(ot);
    }

    private TecnicoId crearTecnico(Long usuarioId, boolean ocupado) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        if (ocupado) {
            tecnico.aceptarOrden();
        }
        tecnico.actualizarUbicacion(UBICACION_SERVICIO, Instant.now());
        return tecnicoRepository.save(tecnico).getId();
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
