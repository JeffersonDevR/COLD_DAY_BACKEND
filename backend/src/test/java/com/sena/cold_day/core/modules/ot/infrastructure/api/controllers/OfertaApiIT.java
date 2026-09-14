package com.sena.cold_day.core.modules.ot.infrastructure.api.controllers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
 * REST surface of atomic acceptance (tasks 6b.5/6b.8): a technician accepts its
 * pending offer and the OT becomes {@code ASIGNADA}; a second accept or an
 * expired offer is a 409; the technician polls its own vigente pending offers.
 * The escalation sweep is pushed far away so it cannot race the seeded windows.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.dispatch.escalamiento-ms=3600000")
class OfertaApiIT {

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

    private static final Point BOGOTA = new Point(4.6, -74.0);

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
    void acceptingThePendingOfferAssignsTheOrderToTheTechnician() throws Exception {
        Long usuarioId = crearUsuario("tecnico-acepta@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        Ot ot = crearOtBuscando();
        OfertaOt oferta = ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                Instant.now(), Instant.now().plusSeconds(60)));

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ot.getId().valor().toString()))
                .andExpect(jsonPath("$.estado").value("ASIGNADA"))
                .andExpect(jsonPath("$.tecnicoId").value(tecnicoId.valor().toString()));

        assertThat(ofertaRepository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.ACEPTADA));
        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.ASIGNADA));
        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnicoId))
                .hasValueSatisfying(found -> assertThat(found.getEstadoOperativo())
                        .isEqualTo(EstadoOperativo.OCUPADO));
        assertThat(springDataHistorial.findByOtIdOrderByOcurridoEnAscIdAsc(ot.getId().valor()))
                .last()
                .satisfies(entrada -> {
                    assertThat(entrada.getEstadoOrigen()).isEqualTo(EstadoOt.BUSCANDO_TECNICO);
                    assertThat(entrada.getEstadoDestino()).isEqualTo(EstadoOt.ASIGNADA);
                    assertThat(entrada.getActor()).isEqualTo(ActorOt.TECNICO);
                });
    }

    @Test
    void acceptingTheSameOfferTwiceIsAConflict() throws Exception {
        Long usuarioId = crearUsuario("tecnico-doble@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        Ot ot = crearOtBuscando();
        OfertaOt oferta = ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                Instant.now(), Instant.now().plusSeconds(60)));
        String token = jwt(usuarioId);

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void acceptingAnExpiredOfferIsAConflictAndLeavesTheOrderUntouched() throws Exception {
        Long usuarioId = crearUsuario("tecnico-expirada@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        Ot ot = crearOtBuscando();
        Instant ahora = Instant.now();
        OfertaOt expirada = ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                ahora.minusSeconds(120), ahora.minusSeconds(60)));

        mockMvc.perform(post("/api/ofertas/" + expirada.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(usuarioId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        assertThat(otRepository.buscarPorId(ot.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(EstadoOt.BUSCANDO_TECNICO));
        assertThat(ofertaRepository.buscarPorId(expirada.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void rejectingAnOfferThatBelongsToAnotherTechnicianIsAConflict() throws Exception {
        Long duenoId = crearUsuario("tecnico-dueno@example.com");
        TecnicoId dueno = crearTecnicoDisponible(duenoId);
        Long intrusoId = crearUsuario("tecnico-intruso@example.com");
        crearTecnicoDisponible(intrusoId);
        Ot ot = crearOtBuscando();
        OfertaOt oferta = ofertaRepository.save(OfertaOt.crear(ot.getId(), dueno, 10.0,
                Instant.now(), Instant.now().plusSeconds(60)));

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar")
                        .header("Authorization", "Bearer " + jwt(intrusoId)))
                .andExpect(status().isConflict());

        assertThat(ofertaRepository.buscarPorId(oferta.getId()))
                .hasValueSatisfying(found -> assertThat(found.getEstado()).isEqualTo(OfertaEstado.PENDIENTE));
    }

    @Test
    void rejectsUnauthenticatedAcceptance() throws Exception {
        Long usuarioId = crearUsuario("tecnico-anon@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        Ot ot = crearOtBuscando();
        OfertaOt oferta = ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                Instant.now(), Instant.now().plusSeconds(60)));

        mockMvc.perform(post("/api/ofertas/" + oferta.getId() + "/aceptar"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listsOnlyTheAuthenticatedTechniciansVigentePendingOffers() throws Exception {
        Long usuarioId = crearUsuario("tecnico-lista@example.com");
        TecnicoId tecnicoId = crearTecnicoDisponible(usuarioId);
        Ot ot = crearOtBuscando();
        Instant ahora = Instant.now();
        OfertaOt vigente = ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 10.0,
                ahora, ahora.plusSeconds(60)));
        ofertaRepository.save(OfertaOt.crear(ot.getId(), tecnicoId, 15.0,
                ahora.minusSeconds(120), ahora.minusSeconds(60)));

        mockMvc.perform(get("/api/tecnicos/me/ofertas")
                        .header("Authorization", "Bearer " + jwt(usuarioId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(vigente.getId().valor().toString()))
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE"))
                .andExpect(jsonPath("$[0].otId").value(ot.getId().valor().toString()));
    }

    @Test
    void returnsAnEmptyListWhenTheTechnicianHasNoVigenteOffers() throws Exception {
        Long usuarioId = crearUsuario("tecnico-sin-ofertas@example.com");
        crearTecnicoDisponible(usuarioId);

        mockMvc.perform(get("/api/tecnicos/me/ofertas")
                        .header("Authorization", "Bearer " + jwt(usuarioId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private Ot crearOtBuscando() {
        Instant ahora = Instant.now();
        Ot ot = Ot.crear(ClienteId.nueva(), CategoriaServicio.REFRIGERACION, "No enciende", List.of(),
                "Calle 1", BOGOTA, ahora);
        ot.iniciarBusqueda(10.0, ahora.plusSeconds(60), ActorOt.CLIENTE, ahora);
        return otRepository.save(ot);
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
