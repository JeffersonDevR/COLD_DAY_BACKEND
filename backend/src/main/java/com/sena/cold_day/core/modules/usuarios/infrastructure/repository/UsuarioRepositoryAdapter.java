package com.sena.cold_day.core.modules.usuarios.infrastructure.repository;

import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.sena.cold_day.core.modules.usuarios.domain.aggregates.Usuario;
import com.sena.cold_day.core.modules.usuarios.domain.exception.CorreoDuplicadoException;
import com.sena.cold_day.core.modules.usuarios.domain.repository.UsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.domain.valueobjects.UsuarioId;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.SpringDataUsuarioRepository;
import com.sena.cold_day.core.modules.usuarios.infrastructure.persistence.UsuarioJpaEntity;

@Repository
public class UsuarioRepositoryAdapter implements UsuarioRepository {

    private final SpringDataUsuarioRepository repository;

    public UsuarioRepositoryAdapter(SpringDataUsuarioRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Usuario save(Usuario usuario) {
        try {
            UsuarioJpaEntity saved = repository.saveAndFlush(UsuarioJpaEntity.fromDomain(usuario));
            return saved.toDomain();
        } catch (DataIntegrityViolationException e) {
            throw new CorreoDuplicadoException(usuario.getCorreo());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Usuario> buscarPorId(UsuarioId id) {
        return repository.findById(id.valor()).map(UsuarioJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Usuario> buscarPorCorreo(String correo) {
        return repository.findByCorreo(correo).map(UsuarioJpaEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existeCorreo(String correo) {
        return repository.existsByCorreo(correo);
    }
}
