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
}
