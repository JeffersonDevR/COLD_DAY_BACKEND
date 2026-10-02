package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.ot.infrastructure.persistence.SpringDataOfertaOtRepository;
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
 * Visit-lifecycle REST surface (RF-F1-14/15/26): arrival confirmation, visit
 * payment and technician rating.
 *
 * <p>Three guarantees are proved here that the use-case unit tests cannot: the
 * role split ({@code CLIENTE} pays and rates, {@code TECNICO} confirms
 * arrival), participant ownership (a stranger is 403 on all three, not 500),
 * and that the domain preconditions surface as 409 instead of an unhandled
 * error.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.dispatch.escalamiento-ms=3600000",
        "app.maps.enabled=false",
})
class OtVisitaCalificacionIT {

    private static final Point UBICACION_SERVICIO = new Point(7.8939, -72.5078);

    @Autowired MockMvc mockMvc;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired ClienteRepository clienteRepository;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        clienteRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    // ---------------------------------------------------------------- llegada

    @Test
    void theAssignedTechnicianConfirmsArrivalWithoutChangingTheState() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-llegada@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-llegada@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_CAMINO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO)))
                // Arrival is a fact, not a transition (SRS 5.2 has no
                // EN_LLEGADO), so the state stays where the technician left it.
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_CAMINO"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getLlegadaEn()).isNotNull();
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
                });
        // A fact produces no history entry: the audit trail only holds transitions.
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor())).isEmpty();
        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnicoId)).isPresent();
    }

    @Test
    void confirmingArrivalTwiceIsIdempotentAndKeepsTheOriginalInstant() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-llegada-2@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-llegada-2@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_CAMINO);
        String token = jwt(tecnicoUsuario, Rol.TECNICO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        Instant original = otRepository.buscarPorId(ot.getId()).orElseThrow().getLlegadaEn();

        // Ot.confirmarLlegada returns early when llegadaEn is already set: a
        // client retry must not be able to falsify the real arrival time.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("EN_CAMINO"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getLlegadaEn()).isEqualTo(original);
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
                });
    }

    @Test
    void confirmingArrivalOutsideEnCaminoIsAConflict() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-llegada-3@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-llegada-3@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.ASIGNADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getLlegadaEn()).isNull();
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.ASIGNADA);
                });
    }

    @Test
    void aClientCannotConfirmArrival() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-llegada-4@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-llegada-4@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_CAMINO);

        // Even as the owning client: arrival is the technician's to report.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE)))
                .andExpect(status().isForbidden())
                // Denials raised inside the security layer carry the canonical
                // array envelope of SecurityConfig, not the advice's object one.
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getLlegadaEn()).isNull());
    }

    @Test
    void aTechnicianWhoIsNotAssignedCannotConfirmArrival() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-llegada-5@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long duenoUsuario = crearUsuario("tecnico-dueno-llegada@example.com", Rol.TECNICO);
        TecnicoId dueno = crearTecnico(duenoUsuario);
        Long intrusoUsuario = crearUsuario("tecnico-intruso-llegada@example.com", Rol.TECNICO);
        crearTecnico(intrusoUsuario);
        Ot ot = otEnEstado(cliente.getId(), dueno, EstadoOt.EN_CAMINO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/llegada")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.TECNICO)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getLlegadaEn()).isNull());
    }

    @Test
    void rejectsUnauthenticatedArrivalConfirmation() throws Exception {
        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/llegada"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------ pagar visita

    @Test
    void theOwningClientPaysTheVisitFeeAndReopensDispatch() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-pago@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.SOLICITADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"NEQUI\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.medioPagoVisita").value("NEQUI"))
                // Paying reopens dispatch, so the OT leaves its resting state.
                .andExpect(jsonPath("$.estado").value("BUSCANDO_TECNICO"));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getMedioPagoVisita()).isEqualTo("NEQUI");
                    assertThat(found.getVisitaPagadaEn()).isNotNull();
                });
    }

    @Test
    void aSecondVisitPaymentIsAConflictNotADoubleCharge() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-pago-2@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.SOLICITADA);
        String token = jwt(clienteUsuario, Rol.CLIENTE);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"PSE\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"PSE\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // The original charge stands untouched; the retry did not overwrite it.
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getMedioPagoVisita()).isEqualTo("PSE"));
    }

    @Test
    void payingAVisitOutsideAPayableStateIsAConflictAndNotA500() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-pago-3@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-pago-3@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_CAMINO);

        // registrarPagoVisita itself has no state guard; the reopen-dispatch step
        // that follows it does, and TransicionesOt rejects EN_CAMINO -> BUSCANDO_TECNICO.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"EFECTIVO\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
                    assertThat(found.getVisitaPagadaEn()).isNull();
                });
    }

    @Test
    void payingAVisitWithoutAMeaningfulPaymentMethodIsABadRequest() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-pago-4@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Ot ot = otEnEstado(cliente.getId(), null, EstadoOt.SOLICITADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getVisitaPagadaEn()).isNull());
    }

    @Test
    void aClientWhoDoesNotOwnTheOrderCannotPayTheVisit() throws Exception {
        Long duenoUsuario = crearUsuario("cliente-dueno-pago@example.com", Rol.CLIENTE);
        Cliente dueno = crearCliente(duenoUsuario);
        Long intrusoUsuario = crearUsuario("cliente-intruso-pago@example.com", Rol.CLIENTE);
        crearCliente(intrusoUsuario);
        Ot ot = otEnEstado(dueno.getId(), null, EstadoOt.SOLICITADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/pagar-visita")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"medioPago\":\"NEQUI\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getVisitaPagadaEn()).isNull());
    }

    // -------------------------------------------------------------- calificar

    @Test
    void theOwningClientRatesTheAssignedTechnicianOfAFinalizedOrder() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-califica@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estrellas\":4,\"comentario\":\"Puntual y claro\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calificacionEstrellas").value(4))
                .andExpect(jsonPath("$.calificacionComentario").value("Puntual y claro"))
                .andExpect(jsonPath("$.calificacionEn").isNotEmpty());

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getCalificacionEstrellas()).isEqualTo(4);
                    assertThat(found.getCalificacionComentario()).isEqualTo("Puntual y claro");
                    // The rating is about a person: it freezes whoever served it.
                    assertThat(found.getCalificacionTecnicoId()).isEqualTo(tecnicoId);
                });
    }

    @Test
    void ratingATwiceFinishedOrderIsAConflict() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-califica-2@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica-2@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);
        String token = jwt(clienteUsuario, Rol.CLIENTE);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":5}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // The first rating stands; a second one must not overwrite it.
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getCalificacionEstrellas()).isEqualTo(5));
    }

    @Test
    void ratingAnOrderThatIsNotFinalizedIsAConflictAndNotA500() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-califica-3@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica-3@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.EN_CAMINO);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":3}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> {
                    assertThat(found.getCalificacionEstrellas()).isNull();
                    assertThat(found.getEstado()).isEqualTo(EstadoOt.EN_CAMINO);
                });
    }

    @Test
    void aStarScoreOutsideOneToFiveIsABadRequest() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-califica-4@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica-4@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + jwt(clienteUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":9}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getCalificacionEstrellas()).isNull());
    }

    @Test
    void aTechnicianCannotRateTheirOwnService() throws Exception {
        Long clienteUsuario = crearUsuario("cliente-califica-5@example.com", Rol.CLIENTE);
        Cliente cliente = crearCliente(clienteUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica-5@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(cliente.getId(), tecnicoId, EstadoOt.FINALIZADA);

        // Rating is the client's act; the rated party must not review themselves.
        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + jwt(tecnicoUsuario, Rol.TECNICO))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":5}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getCalificacionEstrellas()).isNull());
    }

    @Test
    void aClientWhoDoesNotOwnTheOrderCannotRateIt() throws Exception {
        Long duenoUsuario = crearUsuario("cliente-dueno-califica@example.com", Rol.CLIENTE);
        Cliente dueno = crearCliente(duenoUsuario);
        Long intrusoUsuario = crearUsuario("cliente-intruso-califica@example.com", Rol.CLIENTE);
        crearCliente(intrusoUsuario);
        Long tecnicoUsuario = crearUsuario("tecnico-califica-6@example.com", Rol.TECNICO);
        TecnicoId tecnicoId = crearTecnico(tecnicoUsuario);
        Ot ot = otEnEstado(dueno.getId(), tecnicoId, EstadoOt.FINALIZADA);

        mockMvc.perform(post("/api/ot/" + ot.getId().valor() + "/calificar")
                        .header("Authorization", "Bearer " + jwt(intrusoUsuario, Rol.CLIENTE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$[0].status").value(403));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getCalificacionEstrellas()).isNull());
    }

    @Test
    void rejectsUnauthenticatedRating() throws Exception {
        mockMvc.perform(post("/api/ot/" + UUID.randomUUID() + "/calificar")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estrellas\":5}"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ helpers

    private Ot otEnEstado(ClienteId clienteId, TecnicoId tecnicoId, EstadoOt estado) {
        Ot ot = Ot.reconstituir(OtId.nueva(), clienteId, tecnicoId, CategoriaServicio.REFRIGERACION,
                "No enciende", List.of(), "Calle 1", UBICACION_SERVICIO, estado, 10.0,
                Instant.now().plusSeconds(3600), Instant.now(), Instant.now(), null, null, null, null, null,
                null);
        return otRepository.save(ot);
    }

    private TecnicoId crearTecnico(Long usuarioId) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
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