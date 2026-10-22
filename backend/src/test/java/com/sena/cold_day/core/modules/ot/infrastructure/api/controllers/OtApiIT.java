package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
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
import org.springframework.test.web.servlet.MockMvc;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
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
 * OT REST surface owned by PR5 (task 5.6): creation records {@code SOLICITADA}
 * then advances to {@code BUSCANDO_TECNICO}; state-machine guards surface as
 * 409, unknown orders as 404 and anonymous creation as 401.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OtApiIT {

    private static final String PAYLOAD = "{\"categoriaServicio\":\"REFRIGERACION\","
            + "\"descripcionFalla\":\"No enciende\",\"evidenciaUrls\":[\"http://foto\"],"
            + "\"direccion\":\"Calle 1\",\"latitud\":4.6,\"longitud\":-74.0}";

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        // Technicians reference usuarios, so they go before the users are wiped.
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void createsTheOrderAndRecordsTheInitialStateTransition() throws Exception {
        Long usuarioId = crearUsuario("cliente-ot@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(usuarioId);

        String body = mockMvc.perform(post("/api/ot")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                // The human-readable handle (T1) travels with the order. Only the
                // shape is asserted: the number depends on how many orders the
                // shared test database already holds.
                .andExpect(jsonPath("$.codigo").value(matchesPattern("^OT-\\d{4}-\\d{4,}$")))
                .andExpect(jsonPath("$.clienteId").value(cliente.getId().valor().toString()))
                .andExpect(jsonPath("$.estado").value("BUSCANDO_TECNICO"))
                .andExpect(jsonPath("$.radioKm").value(10.0))
                // Exposed even before acceptance: defaults to zero.
                .andExpect(jsonPath("$.auxiliaresRequeridos").value(0))
                .andReturn().getResponse().getContentAsString();

        String otId = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        mockMvc.perform(get("/api/ot/" + otId + "/historial")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estadoDestino").value("SOLICITADA"))
                .andExpect(jsonPath("$[0].actor").value("CLIENTE"))
                .andExpect(jsonPath("$[1].estadoOrigen").value("SOLICITADA"))
                .andExpect(jsonPath("$[1].estadoDestino").value("BUSCANDO_TECNICO"));
    }

    /**
     * T2: the display names are not a list-only nicety. An OT read from the
     * detail endpoint and an OT returned by a mutation carry the same client and
     * technician names the listing already carried; on an unassigned order the
     * client is still named and the technician is honestly absent.
     */
    @Test
    void theDetailOfAnAssignedOrderCarriesTheClientAndTechnicianNames() throws Exception {
        Long clienteUsuario = crearUsuario("nombres-cliente@example.com", Rol.CLIENTE, "Cliente Ana");
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("nombres-tecnico@example.com", Rol.TECNICO, "Tecnico Luis");
        TecnicoId tecnicoId = tecnicoRepository.save(Tecnico.crear(tecnicoUsuario,
                "ID-" + UUID.randomUUID(), Set.of(CategoriaServicio.REFRIGERACION), Set.of())).getId();
        Instant ahora = Instant.parse("2026-09-14T10:00:00Z");
        // EN_CAMINO: the paid-visit gate guards ASIGNADA -> EN_CAMINO (Ot#iniciarDesplazamiento),
        // and this test is about the names, not about the fee.
        Ot enCamino = otRepository.save(Ot.reconstituir(OtId.nueva(), cliente.getId(), tecnicoId,
                CategoriaServicio.REFRIGERACION, "No enciende", List.of(), "Calle 1", new Point(4.6, -74.0),
                EstadoOt.EN_CAMINO, 10.0, ahora.plusSeconds(60), ahora, ahora, null, null, null, null,
                null, null));

        mockMvc.perform(get("/api/ot/" + enCamino.getId().valor())
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteNombre").value("Cliente Ana"))
                .andExpect(jsonPath("$.tecnicoNombre").value("Tecnico Luis"));

        // A mutation response is built on the same path as the detail: the
        // technician confirming arrival must see the same names.
        mockMvc.perform(post("/api/ot/" + enCamino.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO)))
                .andExpect(status().isOk())
                // Arrival is a fact, not a transition: the state stays EN_CAMINO.
                .andExpect(jsonPath("$.estado").value("EN_CAMINO"))
                .andExpect(jsonPath("$.clienteNombre").value("Cliente Ana"))
                .andExpect(jsonPath("$.tecnicoNombre").value("Tecnico Luis"));
    }

    @Test
    void theResponseOfAnUnassignedOrderCarriesOnlyTheClientName() throws Exception {
        Long usuarioId = crearUsuario("sin-tecnico@example.com", Rol.CLIENTE, "Cliente Ana");
        crearCliente(usuarioId);
        String token = jwt(usuarioId, Rol.CLIENTE);

        String body = mockMvc.perform(post("/api/ot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clienteNombre").value("Cliente Ana"))
                .andExpect(jsonPath("$.tecnicoNombre").value(nullValue()))
                .andReturn().getResponse().getContentAsString();
        String otId = com.jayway.jsonpath.JsonPath.read(body, "$.id");

        mockMvc.perform(get("/api/ot/" + otId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteNombre").value("Cliente Ana"))
                .andExpect(jsonPath("$.tecnicoNombre").value(nullValue()));
    }

    /**
     * The OT read carries its append-only history, so the client renders the
     * audit trail from the read it already makes instead of asking for it
     * separately (and showing an empty timeline against the real backend).
     */
    @Test
    void theDetailOfAnOrderCarriesItsStateHistory() throws Exception {
        Long usuarioId = crearUsuario("cliente-historial@example.com", Rol.CLIENTE);
        crearCliente(usuarioId);
        String token = jwt(usuarioId, Rol.CLIENTE);

        String body = mockMvc.perform(post("/api/ot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String otId = com.jayway.jsonpath.JsonPath.read(body, "$.id");

        mockMvc.perform(get("/api/ot/" + otId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.historial[0].estadoDestino").value("SOLICITADA"))
                .andExpect(jsonPath("$.historial[0].actor").value("CLIENTE"))
                .andExpect(jsonPath("$.historial[1].estadoOrigen").value("SOLICITADA"))
                .andExpect(jsonPath("$.historial[1].estadoDestino").value("BUSCANDO_TECNICO"));
    }

    @Test
    void rejectsUnauthenticatedCreation() throws Exception {        mockMvc.perform(post("/api/ot").contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsNotFoundForAnUnknownOrder() throws Exception {
        Long usuarioId = crearUsuario("sin-ot@example.com", Rol.CLIENTE);
        crearCliente(usuarioId);

        mockMvc.perform(get("/api/ot/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void returnsNotFoundWhenThePrincipalHasNoClientProfile() throws Exception {
        Long usuarioId = crearUsuario("sin-perfil-ot@example.com", Rol.CLIENTE);

        mockMvc.perform(post("/api/ot")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsAnIllegalTransitionWithConflict() throws Exception {
        Long usuarioId = crearUsuario("conflicto-ot@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(usuarioId);
        Instant ahora = Instant.parse("2026-09-14T10:00:00Z");
        Ot terminal = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        terminal.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        terminal.agotarOpciones(ActorOt.SISTEMA, ahora.plusSeconds(60));
        Ot persisted = otRepository.save(terminal);

        mockMvc.perform(post("/api/ot/" + persisted.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(persisted.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado())
                        .isEqualTo(EstadoOt.SIN_TECNICOS_DISPONIBLES));
    }

    @Test
    void cancelsAnOrderBeforeRepairThroughTheGuard() throws Exception {
        Long usuarioId = crearUsuario("cancelar-ot@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(usuarioId);
        Instant ahora = Instant.parse("2026-09-14T10:00:00Z");
        Ot buscando = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        buscando.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        Ot persisted = otRepository.save(buscando);

        mockMvc.perform(post("/api/ot/" + persisted.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"Ya no la necesito\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CANCELADA"))
                .andExpect(jsonPath("$.canceladaPor").value("CLIENTE"));

        assertThat(otRepository.buscarPorId(persisted.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.CANCELADA));
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private Long crearUsuario(String correo, Rol rol) {
        return crearUsuario(correo, rol, "Ana");
    }

    private Long crearUsuario(String correo, Rol rol, String nombre) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar(nombre, correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
