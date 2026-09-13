package com.sena.cold_day.core.modules.usuarios.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.repository.TokenRecuperacionRepositoryAdapter;

@DataJpaTest
@Import(TokenRecuperacionRepositoryAdapter.class)
class TokenRecuperacionRepositoryTest {

    private static final Instant CREADO = Instant.parse("2026-01-01T10:00:00Z");
    private static final Instant EXPIRA = CREADO.plus(Duration.ofMinutes(30));

    @Autowired TokenRecuperacionRepositoryAdapter repository;
    @Autowired SpringDataTokenRecuperacionRepository springData;

    @BeforeEach
    void cleanup() {
        springData.deleteAll();
    }

    @Test
    void savesAndFindsByHashPreservingSingleUseState() {
        TokenRecuperacion saved = repository.save(
                TokenRecuperacion.emitir(new UsuarioId(7L), "hash-abc", CREADO, EXPIRA));

        assertThat(saved.getId()).isNotNull();
        assertThat(repository.buscarPorHash("hash-abc")).hasValueSatisfying(found -> {
            assertThat(found.getId()).isEqualTo(saved.getId());
            assertThat(found.getUsuarioId()).isEqualTo(new UsuarioId(7L));
            assertThat(found.getTokenHash()).isEqualTo("hash-abc");
            assertThat(found.getExpiraEn()).isEqualTo(EXPIRA);
            assertThat(found.isUsado()).isFalse();
        });
        assertThat(repository.buscarPorHash("unknown")).isEmpty();
    }

    @Test
    void marcarUsadoInvalidatesTheToken() {
        TokenRecuperacion saved = repository.save(
                TokenRecuperacion.emitir(new UsuarioId(7L), "hash-1", CREADO, EXPIRA));

        repository.marcarUsado(saved.getId(), CREADO.plusSeconds(60));

        assertThat(repository.buscarPorHash("hash-1")).hasValueSatisfying(found -> {
            assertThat(found.isUsado()).isTrue();
            assertThat(found.estaVigente(CREADO.plusSeconds(61))).isFalse();
        });
    }

    @Test
    void invalidarTodosDeOnlyInvalidatesTheRequestedUser() {
        repository.save(TokenRecuperacion.emitir(new UsuarioId(7L), "hash-a", CREADO, EXPIRA));
        repository.save(TokenRecuperacion.emitir(new UsuarioId(8L), "hash-b", CREADO, EXPIRA));

        repository.invalidarTodosDe(new UsuarioId(7L));

        assertThat(repository.buscarPorHash("hash-a")).hasValueSatisfying(t -> assertThat(t.isUsado()).isTrue());
        assertThat(repository.buscarPorHash("hash-b")).hasValueSatisfying(t -> assertThat(t.isUsado()).isFalse());
    }
}
