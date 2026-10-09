package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
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
import org.springframework.test.web.servlet.MvcResult;

import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.application.usecases.IniciarDesplazamientoUseCase;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.listeners.OtEstadoCambiadoSseListener;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;
import com.sena.cold_day.core.shared.infrastructure.security.JwtTokenIssuer;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;

/**
 * End-to-end coverage of the SSE transport: the ticket endpoint, ticket
 * validation, the participant rule, and the transition that has no dedicated
 * domain event today ({@code EN_CAMINO}) reaching the stream.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SseOtStreamIT {

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired SseTicketService sseTicketService;
    @Autowired SseEmitterRegistry sseEmitterRegistry;
    @Autowired IniciarDesplazamientoUseCase iniciarDesplazamiento;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sseEmitterRegistry.limpiar();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        clienteRepository.deleteAll();
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void ticketRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/sse/ticket"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ticketReturnsCodeAndTtlForAnAuthenticatedUser() throws Exception {
        Long usuarioId = crearUsuario("ticket@example.com", Rol.CLIENTE);

        mockMvc.perform(post("/api/sse/ticket")
                        .header("Authorization", "Bearer " + jwt(usuarioId, Rol.CLIENTE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.codigo").isNotEmpty())
                .andExpect(jsonPath("$.expiraEnSegundos").value(30));
    }

    @Test
    void invalidTicketIsRejectedWith401() throws Exception {
        mockMvc.perform(get("/api/ot/" + UUID.randomUUID() + "/stream")
                        .param("ticket", "no-es-un-ticket")
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void aTicketCannotBeUsedTwice() throws Exception {
        Long clienteUsuario = crearUsuario("replay@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        OtId otId = crearOtBuscando(cliente);
        String ticket = ticketDe(clienteUsuario, Rol.CLIENTE);

        mockMvc.perform(get("/api/ot/" + otId.valor() + "/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted());

        mockMvc.perform(get("/api/ot/" + otId.valor() + "/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aTechnicianCannotStreamAnotherTechniciansOrder() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-ajeno@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoAUsuario = crearUsuario("tecnico-a@example.com", Rol.TECNICO);
        Long tecnicoBUsuario = crearUsuario("tecnico-b@example.com", Rol.TECNICO);
        crearTecnico(tecnicoAUsuario);
        Tecnico tecnicoB = crearTecnico(tecnicoBUsuario);
        OtId otId = crearOtAsignada(cliente, tecnicoB);

        String ticketDeA = ticketDe(tecnicoAUsuario, Rol.TECNICO);

        mockMvc.perform(get("/api/ot/" + otId.valor() + "/stream")
                        .param("ticket", ticketDeA)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void anUnknownOrderWithAValidTicketIs404() throws Exception {
        Long clienteUsuario = crearUsuario("sin-orden@example.com", Rol.CLIENTE);
        crearCliente(clienteUsuario);
        String ticket = ticketDe(clienteUsuario, Rol.CLIENTE);

        mockMvc.perform(get("/api/ot/" + UUID.randomUUID() + "/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    /**
     * The coverage that matters most: {@code EN_CAMINO} is produced by the
     * displacement flow, which publishes no dedicated domain event. Only the
     * repository drain choke point can turn it into an event, so a passing
     * assertion here proves the silent transitions reach the stream.
     */
    @Test
    void aTransitionWithoutADomainEventReachesTheStream() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-stream@example.com", Rol.CLIENTE);
        Long tecnicoUsuario = crearUsuario("tecnico-stream@example.com", Rol.TECNICO);
        Cliente cliente = crearCliente(clienteUsuario);
        Tecnico tecnico = crearTecnico(tecnicoUsuario);
        OtId otId = crearOtAsignada(cliente, tecnico);
        String ticket = ticketDe(tecnicoUsuario, Rol.TECNICO);

        MvcResult stream = mockMvc.perform(get("/api/ot/" + otId.valor() + "/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();

        iniciarDesplazamiento.iniciar(new UsuarioId(tecnicoUsuario), otId);

        String cuerpo = stream.getResponse().getContentAsString();
        assertThat(cuerpo)
                .contains(OtEstadoCambiadoSseListener.EVENTO)
                .contains("EN_CAMINO");
        assertThat(sseEmitterRegistry.contar(otId.valor().toString())).isEqualTo(1);
    }

    /** Ticket issued directly through the service, bound to the given identity. */
    private String ticketDe(Long usuarioId, Rol rol) {
        return sseTicketService.emitir(new AuthenticatedUser(new UsuarioId(usuarioId), rol));
    }

    /** OT in {@code BUSCANDO_TECNICO} owned by the client; no technician assigned. */
    private OtId crearOtBuscando(Cliente cliente) {
        Instant ahora = Instant.now();
        Ot ot = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        ot.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        return otRepository.save(ot).getId();
    }

    /** OT assigned to the technician, ready for the displacement transition. */
    private OtId crearOtAsignada(Cliente cliente, Tecnico tecnico) {
        Instant ahora = Instant.now();
        Ot ot = Ot.crear(cliente.getId(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        ot.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        Ot persistida = otRepository.save(ot);
        otRepository.intentarAsignar(persistida.getId(), tecnico.getId(), ahora, 10.0);
        return persistida.getId();
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private Tecnico crearTecnico(Long usuarioId) {
        return tecnicoRepository.save(Tecnico.crear(usuarioId, "ID-" + usuarioId, Set.of(CategoriaServicio.REFRIGERACION), Set.of()));
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }

    private String jwt(Long usuarioId, Rol rol) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), rol, 0).valor();
    }
}
