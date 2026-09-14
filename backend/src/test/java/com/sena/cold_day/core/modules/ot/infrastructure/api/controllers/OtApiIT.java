package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
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
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
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
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOt.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void createsTheOrderAndRecordsTheInitialStateTransition() throws Exception {
        Long usuarioId = crearUsuario("cliente-ot@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(usuarioId, "cliente-ot@example.com");

        String body = mockMvc.perform(post("/api/ot")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.clienteId").value(cliente.getId().valor().toString()))
                .andExpect(jsonPath("$.estado").value("BUSCANDO_TECNICO"))
                .andExpect(jsonPath("$.radioKm").value(10.0))
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

    @Test
    void rejectsUnauthenticatedCreation() throws Exception {
        mockMvc.perform(post("/api/ot").contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsNotFoundForAnUnknownOrder() throws Exception {
        Long usuarioId = crearUsuario("sin-ot@example.com", Rol.CLIENTE);
        crearCliente(usuarioId, "sin-ot@example.com");

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
        Cliente cliente = crearCliente(usuarioId, "conflicto-ot@example.com");
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
        Cliente cliente = crearCliente(usuarioId, "cancelar-ot@example.com");
        Instant ahora = Instant.parse("2026-09-14T10:00:00Z");
        Ot buscando = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        buscando.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        Ot persisted = otRepository.save(buscando);

        mockMvc.perform(post("/api/ot/" + persisted.getId().valor() + "/cancelar")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CANCELADA"))
                .andExpect(jsonPath("$.canceladaPor").value("CLIENTE"));

        assertThat(otRepository.buscarPorId(persisted.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.CANCELADA));
    }

    private Cliente crearCliente(Long usuarioId, String correo) {
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
