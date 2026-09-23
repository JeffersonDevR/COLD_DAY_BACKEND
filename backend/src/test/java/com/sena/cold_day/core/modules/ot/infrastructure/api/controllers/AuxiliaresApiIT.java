package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
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

import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.ot.domain.aggregates.Ot;
import com.sena.cold_day.core.modules.ot.domain.entities.OfertaOt;
import com.sena.cold_day.core.modules.ot.domain.repository.OfertaOtRepository;
import com.sena.cold_day.core.modules.ot.domain.repository.OtRepository;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.EstadoOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OfertaEstado;
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
 * Auxiliar count over the accept REST surface (spec {@code auxiliares}):
 * {@code POST /api/ofertas/{id}/aceptar} takes an OPTIONAL body. A bodyless call
 * still succeeds with zero auxiliares (aux.S1.1), a valid count is exposed on the
 * response (aux.S1.2), and a negative, ill-typed or over-maximum count is a 400
 * with the canonical shape that leaves the offer pending (aux.S2.1-S2.3).
 *
 * <p>{@code app.auxiliares.max=5} proves the maximum is read from configuration
 * and is not a hardcoded literal: a count of 6 is rejected here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = { "app.dispatch.escalamiento-ms=3600000", "app.auxiliares.max=5" })
class AuxiliaresApiIT {

    private static final Point BOGOTA = new Point(4.6, -74.0);

    @Autowired MockMvc mockMvc;
    @Autowired OfertaOtRepository ofertaRepository;
    @Autowired OtRepository otRepository;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataOfertaOtRepository springDataOfertas;
    @Autowired SpringDataOtEstadoHistorialRepository springDataHistorial;
    @Autowired SpringDataOtRepository springDataOt;
    @Autowired SpringDataTecnicoRepository springDataTecnico;
    @Autowired SpringDataUsuarioRepository usuarioRepository;
    @Autowired JwtTokenIssuer tokenIssuer;

    @BeforeEach
    @AfterEach
    void cleanup() {
        springDataOfertas.deleteAll();
        springDataHistorial.deleteAll();
        springDataOt.deleteAll();
        springDataTecnico.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void acceptingWithoutABodyRecordsZeroAuxiliares() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-sin-body@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ASIGNADA"))
                .andExpect(jsonPath("$.auxiliaresRequeridos").value(0));

        assertThat(otRepository.buscarPorId(oferta.getOtId()))
                .hasValueSatisfying(ot -> assertThat(ot.getAuxiliaresRequeridos()).isZero());
    }

    @Test
    void acceptingWithAValidCountExposesIt() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-dos@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auxiliaresRequeridos").value(2));

        assertThat(otRepository.buscarPorId(oferta.getOtId()))
                .hasValueSatisfying(ot -> assertThat(ot.getAuxiliaresRequeridos()).isEqualTo(2));
    }

    @Test
    void anEmptyBodyObjectAlsoMeansZero() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-vacio@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auxiliaresRequeridos").value(0));
    }

    @Test
    void aNegativeCountIsRejectedWith400AndLeavesTheOfferPending() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-negativo@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors[0]").value("auxiliaresRequeridos no puede ser negativo"));

        assertThat(ofertaRepository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
        assertThat(otRepository.buscarPorId(oferta.getOtId()))
                .hasValueSatisfying(ot -> assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO));
    }

    @Test
    void aNonIntegerCountIsRejectedWith400AndDoesNotAccept() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-texto@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":\"dos\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        assertThat(ofertaRepository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void aCountAboveTheConfiguredMaximumIsRejectedWith400() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-excede@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);

        // app.auxiliares.max=5 in this context: 6 must be rejected.
        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":6}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors[0]").value("auxiliaresRequeridos debe estar entre 0 y 5"));

        assertThat(ofertaRepository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
        assertThat(otRepository.buscarPorId(oferta.getOtId()))
                .hasValueSatisfying(ot -> assertThat(ot.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO));
    }

    /**
     * aux.S6.1: the auxiliar count has an acceptance-only window. Once the OT is
     * {@code ASIGNADA} there is no post-acceptance mutation surface: a dedicated
     * mutation path does not exist (404), the only existing writer cannot be
     * replayed to change the count (409), and the recorded value stays frozen.
     */
    @Test
    void aPostAcceptanceAuxiliarMutationIsRejectedAndTheCountStaysFrozen() throws Exception {
        Long usuarioId = crearUsuario("tecnico-aux-inmutable@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        OfertaOt oferta = ofertaPendiente(crearOtBuscando(), tecnicoId);
        String token = jwt(usuarioId);

        // The winning acceptance is the only writer: it records 2.
        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ASIGNADA"))
                .andExpect(jsonPath("$.auxiliaresRequeridos").value(2));

        // No dedicated post-acceptance auxiliar-mutation endpoint exists.
        mockMvc.perform(post("/api/ot/" + oferta.getOtId().valor() + "/auxiliares")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":9}"))
                .andExpect(status().isNotFound());

        // Replaying the only existing writer after acceptance is a conflict and
        // cannot overwrite the recorded count. The count is within this context's
        // max (5), so the rejection is the acceptance-only window, not validation.
        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"auxiliaresRequeridos\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(oferta.getOtId()))
                .hasValueSatisfying(ot -> assertThat(ot.getAuxiliaresRequeridos()).isEqualTo(2));
    }

    private Ot crearOtBuscando() {
        Instant ahora = Instant.now();
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", java.util.List.of(),
                "Calle 1", BOGOTA, ahora);
        ot.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        return otRepository.save(ot);
    }

    private OfertaOt ofertaPendiente(Ot ot, TecnicoId tecnicoId) {
        Instant ahora = Instant.now();
        return ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                ahora, ahora.plusSeconds(60)));
    }

    private TecnicoId crearTecnicoDisponible(Long usuarioId) {
        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + UUID.randomUUID(),
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.aprobarValidacion(LocalDate.now());
        tecnico.cambiarEstado(EstadoOperativo.DISPONIBLE);
        tecnico.actualizarUbicacion(BOGOTA, Instant.now());
        return tecnicoRepository.save(tecnico).getId();
    }

    private Long crearUsuario(String correo) {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", correo, "secreto", "3001234567", null, Rol.TECNICO, true, encoder);
        return usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();
    }

    private String jwt(Long usuarioId) {
        return tokenIssuer.emitir(new UsuarioId(usuarioId), Rol.TECNICO, 0).valor();
    }
}
