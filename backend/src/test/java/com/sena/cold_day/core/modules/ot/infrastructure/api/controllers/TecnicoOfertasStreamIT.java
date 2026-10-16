package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

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
import com.sena.cold_day.core.modules.ot.application.usecases.IniciarBusquedaTecnicoUseCase;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.listeners.OfertaCreadaSseListener;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoOperativo;
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
 * End-to-end coverage of the technician offer stream: the ticket gate, the
 * technician-profile gate, and the property this channel exists for — an offer
 * created for one technician reaches <em>that</em> technician's stream and no
 * other.
 *
 * <p>The isolation is the point: the OT channel is keyed by OT, so "a new offer
 * for me" could not be expressed at all. Two live streams on the same endpoint,
 * each receiving only its own offer, is what proves the technician namespace
 * works.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TecnicoOfertasStreamIT {

    @Autowired MockMvc mockMvc;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired JwtTokenIssuer tokenIssuer;
    @Autowired SseTicketService sseTicketService;
    @Autowired SseEmitterRegistry sseEmitterRegistry;
    @Autowired IniciarBusquedaTecnicoUseCase iniciarBusqueda;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sseEmitterRegistry.limpiar();
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        clienteRepository.deleteAll();
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void invalidTicketIsRejectedWith401() throws Exception {
        mockMvc.perform(get("/api/tecnicos/me/ofertas/stream")
                        .param("ticket", "no-es-un-ticket")
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    /**
     * A valid ticket only proves identity: a caller with no active technician
     * profile (a client, for example) has no offers to be told about and must not
     * reach the stream.
     */
    @Test
    void aTicketWithoutATechnicianProfileIsForbidden() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-sin-perfil@example.com", Rol.CLIENTE);
        crearCliente(clienteUsuario);

        mockMvc.perform(get("/api/tecnicos/me/ofertas/stream")
                        .param("ticket", ticketDe(clienteUsuario, Rol.CLIENTE))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    /**
     * Two technicians with a live stream each, both available and inside the
     * dispatch radius, distinguished only by the category they serve. Dispatching
     * one OT per category must land on exactly one stream per technician: without
     * the technician namespace — a shared bucket, or a key derived from anything
     * but the recipient technician id — the cross-assertions below fail.
     */
    @Test
    void anOfferReachesOnlyTheTargetTechnicianStream() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-dos-tecnicos@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long usuarioFrio = crearUsuario("tecnico-frio@example.com", Rol.TECNICO);
        Long usuarioLuz = crearUsuario("tecnico-luz@example.com", Rol.TECNICO);
        Tecnico tecnicoFrio = crearTecnicoDisponible(usuarioFrio, CategoriaServicio.REFRIGERACION);
        Tecnico tecnicoLuz = crearTecnicoDisponible(usuarioLuz, CategoriaServicio.ELECTRICIDAD);

        MvcResult streamFrio = abrirStream(ticketDe(usuarioFrio, Rol.TECNICO));
        MvcResult streamLuz = abrirStream(ticketDe(usuarioLuz, Rol.TECNICO));

        OtId otFrio = despachar(cliente, CategoriaServicio.REFRIGERACION);
        OtId otLuz = despachar(cliente, CategoriaServicio.ELECTRICIDAD);

        String cuerpoFrio = streamFrio.getResponse().getContentAsString();
        String cuerpoLuz = streamLuz.getResponse().getContentAsString();

        assertThat(cuerpoFrio)
                .contains(OfertaCreadaSseListener.EVENTO)
                .contains(otFrio.valor().toString())
                .doesNotContain(otLuz.valor().toString());
        assertThat(cuerpoLuz)
                .contains(OfertaCreadaSseListener.EVENTO)
                .contains(otLuz.valor().toString())
                .doesNotContain(otFrio.valor().toString());
        // Two emitters, two distinct buckets: neither stream shares the other's key.
        assertThat(sseEmitterRegistry.contar(OfertaCreadaSseListener.claveTecnico(tecnicoFrio.getId())))
                .isEqualTo(1);
        assertThat(sseEmitterRegistry.contar(OfertaCreadaSseListener.claveTecnico(tecnicoLuz.getId())))
                .isEqualTo(1);
    }

    /** Opens the technician stream with a real ticket and returns the live result. */
    private MvcResult abrirStream(String ticket) throws Exception {
        return mockMvc.perform(get("/api/tecnicos/me/ofertas/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    /**
     * Creates an OT of {@code categoria} and starts dispatch for it. Only
     * technicians serving that category receive an offer.
     */
    private OtId despachar(Cliente cliente, CategoriaServicio categoria) {
        Instant ahora = Instant.now();
        Ot ot = Ot.crear(cliente.getId(), categoria, "No enciende", List.of(),
                "Calle 1", new Point(4.6, -74.0), ahora);
        return iniciarBusqueda.iniciar(ot).getId();
    }

    /** Ticket issued directly through the service, bound to the given identity. */
    private String ticketDe(Long usuarioId, Rol rol) {
        return sseTicketService.emitir(new AuthenticatedUser(new UsuarioId(usuarioId), rol));
    }

    private Long crearUsuario(String correo, Rol rol) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, rol, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    /**
     * Technician eligible for the spatial dispatch query for {@code categoria}:
     * approved, available and located, otherwise no offer is created for them.
     */
    private Tecnico crearTecnicoDisponible(Long usuarioId, CategoriaServicio categoria) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + usuarioId, Set.of(categoria), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.actualizarUbicacion(new Point(4.6, -74.0), Instant.now());
        return tecnicoRepository.save(tecnico);
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }
}
