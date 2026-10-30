package com.sena.cold_day.core.modules.administracion.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
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

import com.sena.cold_day.core.modules.administracion.application.dto.DisputaResponse;
import com.sena.cold_day.core.modules.administracion.application.usecases.GestionarDisputaUseCase;
import com.sena.cold_day.core.modules.administracion.application.usecases.VerificarComprobanteUseCase;
import com.sena.cold_day.core.modules.administracion.domain.aggregates.Liquidacion;
import com.sena.cold_day.core.modules.administracion.domain.repository.LiquidacionRepository;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.LiquidacionId;
import com.sena.cold_day.core.modules.administracion.domain.valueobjects.MedioPago;
import com.sena.cold_day.core.modules.administracion.infrastructure.listeners.AdminActividadSseListener;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.SpringDataDisputaRepository;
import com.sena.cold_day.core.modules.administracion.infrastructure.persistence.SpringDataLiquidacionRepository;
import com.sena.cold_day.core.modules.clientes.domain.aggregates.Cliente;
import com.sena.cold_day.core.modules.clientes.domain.repository.ClienteRepository;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.DireccionPrincipal;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.TipoCliente;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtEstadoHistorialRepository;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOtRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;
import com.sena.cold_day.core.shared.infrastructure.security.AuthenticatedUser;
import com.sena.cold_day.core.shared.infrastructure.sse.SseEmitterRegistry;
import com.sena.cold_day.core.shared.infrastructure.sse.SseTicketService;

/**
 * End-to-end coverage of the admin activity stream: the ticket gate, the
 * administrator gate, and the property the channel exists for — an event that
 * no screen was polling reaches every open admin stream.
 *
 * <p>Two of the eight bridged events are driven through their real use cases
 * (a dispute opened by a client, a liquidation approved by an admin), so the
 * assertions cover the whole path: use case -> domain event -> AFTER_COMMIT
 * listener -> registry -> client response.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminStreamIT {

    // Inside the configured service area, so the OT fixtures are realistic.
    private static final Point UBICACION = new Point(7.8939, -72.5078);

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired LiquidacionRepository liquidacionRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataDisputaRepository springDataDisputa;
    @Autowired SpringDataLiquidacionRepository springDataLiquidacion;
    @Autowired SseTicketService sseTicketService;
    @Autowired SseEmitterRegistry sseEmitterRegistry;
    @Autowired GestionarDisputaUseCase disputas;
    @Autowired VerificarComprobanteUseCase comprobantes;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sseEmitterRegistry.limpiar();
        springDataDisputa.deleteAll();
        springDataLiquidacion.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        clienteRepository.deleteAll();
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void aMissingTicketIsRejectedWith401Json() throws Exception {
        mockMvc.perform(get("/api/admin/stream").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void anInvalidTicketIsRejectedWith401Json() throws Exception {
        mockMvc.perform(get("/api/admin/stream")
                        .param("ticket", "no-es-un-ticket")
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    /**
     * A valid ticket only proves identity: a client has nothing to see on the
     * admin feed and must be answered with a 403, not an anonymous 401.
     */
    @Test
    void aClientTicketIsForbidden() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-admin-stream@example.com", Rol.CLIENTE);

        mockMvc.perform(get("/api/admin/stream")
                        .param("ticket", ticketDe(clienteUsuario, Rol.CLIENTE))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(403));
        assertThat(sseEmitterRegistry.contar(AdminActividadSseListener.claveAdmin())).isZero();
    }

    @Test
    void aTechnicianTicketIsForbidden() throws Exception {
        Long tecnicoUsuario = crearUsuario("tecnico-admin-stream@example.com", Rol.TECNICO);

        mockMvc.perform(get("/api/admin/stream")
                        .param("ticket", ticketDe(tecnicoUsuario, Rol.TECNICO))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(403));
        assertThat(sseEmitterRegistry.contar(AdminActividadSseListener.claveAdmin())).isZero();
    }

    @Test
    void anAdminTicketOpensTheSingleAdminBucket() throws Exception {
        MvcResult stream = abrirStream(ticketDe(crearUsuario("admin-stream@example.com", Rol.ADMINISTRADOR),
                Rol.ADMINISTRADOR));

        assertThat(stream.getResponse().getContentAsString()).isEmpty();
        assertThat(sseEmitterRegistry.contar(AdminActividadSseListener.claveAdmin())).isEqualTo(1);
    }

    /**
     * The gap this channel closes: a client opening a dispute is not polled by
     * the admin panel, so without the listener the dispute would exist and the
     * admin would only see it on the next manual reload.
     */
    @Test
    void anOpenDisputeReachesAnAlreadySubscribedAdmin() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-disputa-stream@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-disputa-stream@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario).getId();
        OtId otId = crearOt(EstadoOt.EN_DIAGNOSTICO, cliente.getId(), tecnicoId);
        Long adminUsuario = crearUsuario("admin-disputa-stream@example.com", Rol.ADMINISTRADOR);

        MvcResult stream = abrirStream(ticketDe(adminUsuario, Rol.ADMINISTRADOR));
        DisputaResponse disputa = disputas.abrir(new UsuarioId(clienteUsuario), otId, "Trabajo incompleto");

        String cuerpo = stream.getResponse().getContentAsString();
        assertThat(cuerpo)
                .contains(AdminActividadSseListener.EVENTO)
                .contains(AdminActividadSseListener.DISPUTA_ABIERTA)
                .contains(disputa.id().valor().toString());
        assertThat(sseEmitterRegistry.contar(AdminActividadSseListener.claveAdmin())).isEqualTo(1);
    }

    /**
     * Same property for the liquidation side: approving a receipt changes the
     * technician's availability, and the admin panel reloads off this event.
     */
    @Test
    void anApprovedLiquidationReachesAnAlreadySubscribedAdmin() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-liquidacion-stream@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-liquidacion-stream@example.com", Rol.TECNICO);
        Tecnico tecnico = crearTecnico(tecnicoUsuario);
        OtId otId = crearOt(EstadoOt.EN_REPARACION, cliente.getId(), tecnico.getId());
        LiquidacionId liquidacionId = crearLiquidacionEnVerificacion(otId, tecnico.getId());
        Long adminUsuario = crearUsuario("admin-liquidacion-stream@example.com", Rol.ADMINISTRADOR);

        MvcResult stream = abrirStream(ticketDe(adminUsuario, Rol.ADMINISTRADOR));
        comprobantes.aprobar(liquidacionId);

        String cuerpo = stream.getResponse().getContentAsString();
        assertThat(cuerpo)
                .contains(AdminActividadSseListener.EVENTO)
                .contains(AdminActividadSseListener.LIQUIDACION_APROBADA)
                .contains(liquidacionId.valor().toString());
        assertThat(sseEmitterRegistry.contar(AdminActividadSseListener.claveAdmin())).isEqualTo(1);
    }

    /** Opens the admin stream with a real ticket and returns the live result. */
    private MvcResult abrirStream(String ticket) throws Exception {
        return mockMvc.perform(get("/api/admin/stream")
                        .param("ticket", ticket)
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    /** Ticket issued directly through the service, bound to the given identity. */
    private String ticketDe(Long usuarioId, Rol rol) {
        return sseTicketService.emitir(new AuthenticatedUser(new UsuarioId(usuarioId), rol));
    }

    /** OT of the fixture walk in the requested state, owned by the client. */
    private OtId crearOt(EstadoOt estado, ClienteId clienteId, TecnicoId tecnicoId) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(), null, null, null, null, null, null);
        return otRepository.save(ot).getId();
    }

    /** Liquidation waiting for the admin, the state the approval use case requires. */
    private LiquidacionId crearLiquidacionEnVerificacion(OtId otId, TecnicoId tecnicoId) {
        Liquidacion liquidacion = Liquidacion.registrar(otId, tecnicoId, new BigDecimal("100000.00"),
                MedioPago.EFECTIVO, new BigDecimal("0.10"), Instant.now());
        liquidacion.cargarComprobante("https://soporte.example.com/comprobante.jpg");
        return liquidacionRepository.save(liquidacion).getId();
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
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + usuarioId,
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.of(2026, 1, 1));
        return tecnicoRepository.save(tecnico);
    }

    private Cliente crearCliente(Long usuarioId) {
        return clienteRepository.save(Cliente.registrar(new UsuarioId(usuarioId), TipoCliente.B2C,
                DireccionPrincipal.sinUbicacion("Calle 1", "Bogota", "Centro")));
    }
}
