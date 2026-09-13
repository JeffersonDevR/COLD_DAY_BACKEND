package com.sena.cold_day.core.modules.usuarios.infrastructure.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.repository.TokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.TokenRecuperacion;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataTokenRecuperacionRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.TokenRecuperacionJpaEntity;

@Repository
public class TokenRecuperacionRepositoryAdapter implements TokenRecuperacionRepository {

    private final SpringDataTokenRecuperacionRepository repository;

    public TokenRecuperacionRepositoryAdapter(SpringDataTokenRecuperacionRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public TokenRecuperacion save(TokenRecuperacion token) {
        return repository.saveAndFlush(TokenRecuperacionJpaEntity.fromDomain(token)).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TokenRecuperacion> buscarPorHash(String tokenHash) {
        return repository.findByTokenHash(tokenHash).map(TokenRecuperacionJpaEntity::toDomain);
    }

    @Override
    @Transactional
    public void marcarUsado(Long id, Instant ahora) {
        repository.findById(id).ifPresent(entity -> {
            entity.setUsado(true);
            repository.save(entity);
        });
    }

    @Override
    @Transactional
    public void invalidarTodosDe(UsuarioId usuarioId) {
        repository.invalidarPendientesDe(usuarioId.valor());
    }
}
