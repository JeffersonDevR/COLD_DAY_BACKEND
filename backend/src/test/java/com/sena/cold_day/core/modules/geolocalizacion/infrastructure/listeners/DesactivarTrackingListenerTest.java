package com.sena.cold_day.core.modules.geolocalizacion.infrastructure.listeners;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.time.Instant;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;

import com.sena.cold_day.core.modules.ot.domain.events.OtCancelada;
import com.sena.cold_day.core.modules.ot.domain.events.OtFinalizada;
import com.sena.cold_day.core.modules.ot.domain.events.OtSinTecnicosDisponibles;
import com.sena.cold_day.core.modules.ot.domain.events.OtCreada;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.ActorOt;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.MotivoCancelacion;
import com.sena.cold_day.core.modules.ot.domain.valueobjects.OtId;
import com.sena.cold_day.core.modules.clientes.domain.valueobjects.ClienteId;
import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;
import com.sena.cold_day.core.shared.domain.Point;

/**
 * RF-F1-27 wiring (task 5.6/PR5): the terminal OT events published by the
 * lifecycle deactivate the assigned technician's tracking, retaining the final
 * coordinates. This proves the PR4 seam is now subscribed, not just callable.
 */
@SpringBootTest
class DesactivarTrackingListenerTest {

    private static final Point BOGOTA = new Point(4.65, -74.05);
    private static final Instant AHORA = Instant.parse("2026-09-14T10:00:00Z");

    @Autowired ApplicationEventPublisher events;
    @Autowired TecnicoRepository tecnicoRepository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    @AfterEach
    void cleanup() {
        tecnicoRepository.deleteAll();
        usuarioRepository.deleteAll();
    }

    @Test
    void finalizadaDeactivatesTrackingAndRetainsTheFinalCoordinates() {
        Tecnico tecnico = crearTecnicoConTracking();

        events.publishEvent(new OtFinalizada(OtId.nueva(), tecnico.getId()));

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId())).hasValueSatisfying(found -> {
            assertThat(found.isTrackingActivo()).isFalse();
            assertThat(found.getUbicacion()).isEqualTo(BOGOTA);
            assertThat(found.getUbicacionActualizadaEn()).isNotNull();
        });
    }

    @Test
    void canceladaDeactivatesTrackingForTheAssignedTechnician() {
        Tecnico tecnico = crearTecnicoConTracking();

        events.publishEvent(new OtCancelada(OtId.nueva(), ActorOt.CLIENTE,
                MotivoCancelacion.CANCELACION_CLIENTE, tecnico.getId()));

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId()))
                .hasValueSatisfying(found -> assertThat(found.isTrackingActivo()).isFalse());
    }

    @Test
    void canceladaBeforeAssignmentIsANoOp() {
        Tecnico tecnico = crearTecnicoConTracking();

        assertThatCode(() -> events.publishEvent(new OtCancelada(OtId.nueva(), ActorOt.CLIENTE,
                MotivoCancelacion.CANCELACION_CLIENTE, null))).doesNotThrowAnyException();

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId()))
                .hasValueSatisfying(found -> assertThat(found.isTrackingActivo()).isTrue());
    }

    @Test
    void sinTecnicosDisponiblesIsHandledWithoutAnAssignedTechnician() {
        assertThatCode(() -> events.publishEvent(new OtSinTecnicosDisponibles(OtId.nueva(), ClienteId.nueva())))
                .doesNotThrowAnyException();
    }

    @Test
    void aNonTerminalEventDoesNotDeactivateTracking() {
        Tecnico tecnico = crearTecnicoConTracking();

        events.publishEvent(new OtCreada(OtId.nueva(), ClienteId.nueva()));

        assertThat(tecnicoRepository.findByIdAndActivoTrue(tecnico.getId()))
                .hasValueSatisfying(found -> assertThat(found.isTrackingActivo()).isTrue());
    }

    /**
     * PR4 seam decision: a terminal event for a technician without an active
     * profile must not roll back the terminal OT transition — there is nothing
     * left to deactivate.
     */
    @Test
    void finalizadaForAnUnknownTechnicianDoesNotThrow() {
        assertThatCode(() -> events.publishEvent(new OtFinalizada(OtId.nueva(),
                com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.TecnicoId.nueva())))
                .doesNotThrowAnyException();
    }

    private Tecnico crearTecnicoConTracking() {
        PasswordEncoderPort encoder = new PasswordEncoderPort() {
            public String encode(String p) { return "fake:" + p; }
            public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
        };
        Usuario usuario = Usuario.registrar("Ana", "tracking-ot@example.com", "secreto", null, null,
                Rol.TECNICO, true, encoder);
        Long usuarioId = usuarioRepository.save(UsuarioJpaEntity.fromDomain(usuario)).getId();

        Tecnico tecnico = Tecnico.crear(usuarioId, "ID-" + usuarioId,
                Set.of(CategoriaServicio.REFRIGERACION), Set.of());
        tecnico.actualizarUbicacion(BOGOTA, AHORA);
        return tecnicoRepository.save(tecnico);
    }
}
