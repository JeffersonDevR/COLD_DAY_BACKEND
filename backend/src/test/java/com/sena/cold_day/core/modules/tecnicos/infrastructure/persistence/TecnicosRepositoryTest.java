package com.sena.cold_day.core.modules.tecnicos.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.sena.cold_day.core.modules.tecnicos.domain.aggregates.Tecnico;
import com.sena.cold_day.core.modules.tecnicos.domain.repository.TecnicoRepository;
import com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.CategoriaServicio;
import com.sena.cold_day.core.modules.tecnicos.infrastructure.repository.TecnicoRepositoryAdapter;
import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.shared.domain.Point;

@DataJpaTest
@Import(TecnicoRepositoryAdapter.class)
class TecnicosRepositoryTest {

    @Autowired TecnicoRepositoryAdapter repository;
    @Autowired SpringDataUsuarioRepository usuarioRepository;

    @BeforeEach
    void cleanup() {
        repository.deleteAll();
        usuarioRepository.deleteAll();
    }

    /** Saves the user first: tecnico.usuario_id references usuario.id. */
    private Tecnico tecnico(Long usuarioId, String numeroIdentificacion, boolean activo) {
        Tecnico tecnico = Tecnico.crear(usuarioId, numeroIdentificacion,
                Set.of(CategoriaServicio.REFRIGERACION),
                Set.of(new com.sena.cold_day.core.modules.tecnicos.domain.entities.Certificacion(
                        "Tecnico", "SENA", LocalDate.of(2027, 1, 31))));
        if (!activo) {
            tecnico.desactivar();
        }
        return tecnico;
    }

    private Long persistUsuario(String correo) {
        com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort encoder =
                new com.sena.cold_day.core.modules.usuarios.domain.services.PasswordEncoderPort() {
                    public String encode(String p) { return "fake:" + p; }
                    public boolean matches(String p, String h) { return ("fake:" + p).equals(h); }
                };
        Usuario usuarioDomain = Usuario.registrar("Ana", correo, "secreto", null, null,
                com.sena.cold_day.core.modules.usuarios.domain.valueobjects.Rol.TECNICO, true, encoder);
        com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity saved =
                usuarioRepository.save(com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity
                        .fromDomain(usuarioDomain));
        return saved.getId();
    }

    /**
     * Own-UUID identity (design D12): tecnico keeps its own TecnicoId primary key
     * and references usuario through the scalar usuario_id column. It no longer
     * shares usuario's primary key.
     */
    @Test
    void keepsOwnUuidAndReferencesUsuario() {
        Long usuarioId = persistUsuario("ana@example.com");
        Tecnico toSave = tecnico(usuarioId, "123", true);

        Tecnico saved = repository.save(toSave);

        assertThat(saved.getId()).isEqualTo(toSave.getId());
        assertThat(saved.getId().valor()).isNotNull();
        assertThat(saved.getUsuarioId()).isEqualTo(usuarioId);
        assertThat(saved.getEstadoValidacion())
                .isEqualTo(com.sena.cold_day.core.modules.tecnicos.domain.valueobjects.EstadoValidacion.PENDIENTE);
    }

    @Test
    void rejectsDuplicateNumeroIdentificacion() {
        Long usuarioId = persistUsuario("ana@example.com");
        repository.save(tecnico(usuarioId, "123", true));
        Long otro = persistUsuario("luis@example.com");
        assertThatThrownBy(() -> repository.save(tecnico(otro, "123", true)))
                .isInstanceOf(com.sena.cold_day.core.modules.tecnicos.domain.exception.NumeroIdentificacionDuplicadoException.class);
    }

    @Test
    void findMethodsExcludeSoftDeletedRows() {
        repository.save(tecnico(persistUsuario("a@example.com"), "100", true));
        Tecnico deleted = repository.save(tecnico(persistUsuario("b@example.com"), "200", false));
        assertThat(repository.findByActivoTrue())
                .extracting(Tecnico::getNumeroIdentificacion).containsExactly("100");
        assertThat(repository.findByIdAndActivoTrue(deleted.getId())).isEmpty();
    }

    @Test
    void retainsSoftDeletedRow() {
        Tecnico deleted = repository.save(tecnico(persistUsuario("m@example.com"), "300", false));
        assertThat(repository.findByIdAndActivoTrue(deleted.getId())).isEmpty();
    }

    @Test
    void roundTripsLocationAndTrackingFlag() {
        Long usuarioId = persistUsuario("geo@example.com");
        Tecnico tecnico = tecnico(usuarioId, "400", true);
        java.time.Instant ahora = java.time.Instant.parse("2026-02-01T12:00:00Z");
        tecnico.actualizarUbicacion(new Point(4.6, -74.0), ahora);

        Tecnico saved = repository.save(tecnico);

        assertThat(repository.findByIdAndActivoTrue(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.getUbicacion()).isEqualTo(new Point(4.6, -74.0));
            assertThat(found.isTrackingActivo()).isTrue();
            assertThat(found.getUbicacionActualizadaEn()).isEqualTo(ahora);
        });

        // Deactivation keeps the final coordinates (RF-F1-27).
        saved.desactivarTracking();
        repository.save(saved);

        assertThat(repository.findByIdAndActivoTrue(saved.getId())).hasValueSatisfying(found -> {
            assertThat(found.isTrackingActivo()).isFalse();
            assertThat(found.getUbicacion()).isEqualTo(new Point(4.6, -74.0));
        });
    }
}
